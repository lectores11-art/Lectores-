-- Migration 006: RLS hardening (S2-05)
-- Note: task brief named this 004_rls_hardening.sql, but 004/005 already exist
-- (storage books RLS + pipeline version). Next free number is 006.
--
-- Goal: close critical multi-tenant holes without rewriting the whole schema.
-- Apply via Supabase SQL Editor / migration runner — do NOT run against prod
-- from the agent. Repo-only change.
--
-- Role × table × operation matrix (summary): see docs/RLS-MATRIX.md

-- ---------------------------------------------------------------------------
-- Helpers: owners without a membership row still count as members/admins
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND community_id = p_community_id
      AND status = 'active'
  ) OR is_super_admin() OR EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_community_ids()
RETURNS SETOF UUID AS $$
  SELECT community_id FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  UNION
  SELECT id FROM communities WHERE owner_id = auth.uid()
  UNION
  SELECT id FROM communities WHERE is_super_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ---------------------------------------------------------------------------
-- profiles: block is_super_admin self-elevation; allow peer name reads
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_super_admin_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    -- Authenticated JWT clients must never flip this column.
    -- service_role / postgres (dashboard SQL) may still change it.
    IF coalesce(auth.role(), '') = 'authenticated' THEN
      RAISE EXCEPTION 'is_super_admin cannot be changed by authenticated clients';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_flag ON profiles;
CREATE TRIGGER trg_protect_super_admin_flag
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_super_admin_flag();

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM memberships my
      JOIN memberships peer
        ON peer.community_id = my.community_id
       AND peer.status = 'active'
      WHERE my.user_id = auth.uid()
        AND my.status = 'active'
        AND peer.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM communities c
      WHERE c.owner_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1 FROM memberships m
            WHERE m.community_id = c.id
              AND m.user_id = profiles.id
              AND m.status = 'active'
          )
          OR profiles.id = c.owner_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- communities: allow reading a community that has a matching active invite
-- token (exact token equality — no listing without the token). Used by
-- invite landing when joined from invites select under tighter policies.
-- Also keep member/admin visibility.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view their communities" ON communities;
CREATE POLICY "Members can view their communities" ON communities
  FOR SELECT
  USING (
    is_community_member(id)
    OR is_super_admin()
    OR owner_id = auth.uid()
  );

-- Invite landing (GET /api/invites/[token]) loads community via service_role
-- after exact-token validation — no public communities SELECT needed.

-- ---------------------------------------------------------------------------
-- invites: stop listing all active tokens; require exact token or admin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read active invite by token" ON invites;

-- Lookup by exact token (PostgREST .eq('token', ...) still works: policy
-- allows rows where the caller already filtered to a specific token value
-- only if is_active — BUT Postgres RLS cannot see the filter predicate.
-- Therefore we expose a SECURITY DEFINER RPC for token lookup and restrict
-- SELECT to admins + creators. App routes must use the RPC or service_role.
CREATE OR REPLACE FUNCTION lookup_invite_by_token(p_token text)
RETURNS SETOF invites
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM invites
  WHERE token = p_token
    AND is_active = TRUE;
$$;

REVOKE ALL ON FUNCTION lookup_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_invite_by_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Admins manage invites" ON invites;
CREATE POLICY "Admins manage invites" ON invites
  FOR ALL
  USING (is_community_admin(community_id) OR is_super_admin())
  WITH CHECK (is_community_admin(community_id) OR is_super_admin());

CREATE POLICY "Admins and creators can read invites" ON invites
  FOR SELECT
  USING (
    is_community_admin(community_id)
    OR is_super_admin()
    OR created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- memberships: no self-join as owner/active without trusted path
-- Client INSERT removed — accept_invite() / service_role join route only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own membership via invite" ON memberships;

CREATE OR REPLACE FUNCTION accept_invite(p_token text)
RETURNS TABLE (community_slug text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invites%ROWTYPE;
  v_slug text;
  v_existing memberships%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM invites
  WHERE token = p_token AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid invite';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'invite expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invite max uses reached';
  END IF;

  SELECT slug INTO v_slug FROM communities WHERE id = v_invite.community_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;

  SELECT * INTO v_existing
  FROM memberships
  WHERE user_id = v_uid AND community_id = v_invite.community_id;

  IF FOUND AND v_existing.status = 'active' THEN
    community_slug := v_slug;
    already_member := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE memberships
    SET status = 'active',
        role = 'member',
        joined_at = NOW(),
        updated_at = NOW()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO memberships (user_id, community_id, role, status, joined_at)
    VALUES (v_uid, v_invite.community_id, 'member', 'active', NOW());
  END IF;

  UPDATE invites
  SET use_count = use_count + 1
  WHERE id = v_invite.id;

  community_slug := v_slug;
  already_member := FALSE;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_invite(text) TO authenticated;

DROP POLICY IF EXISTS "Users can view memberships in their communities" ON memberships;
CREATE POLICY "Users can view memberships in their communities" ON memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_community_admin(community_id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Admins can manage memberships" ON memberships;
CREATE POLICY "Admins can manage memberships" ON memberships
  FOR ALL
  USING (is_community_admin(community_id) OR is_super_admin())
  WITH CHECK (is_community_admin(community_id) OR is_super_admin());

-- ---------------------------------------------------------------------------
-- subscriptions: allow owner to update/cancel own subscription rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_id
        AND (m.user_id = auth.uid() OR is_community_admin(m.community_id) OR is_super_admin())
    )
  );

DROP POLICY IF EXISTS "Users update own subscriptions" ON subscriptions;
CREATE POLICY "Users update own subscriptions" ON subscriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = membership_id AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- User-scoped content: must own row AND belong to the parent community
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members manage reactions" ON forum_reactions;
CREATE POLICY "Members manage reactions" ON forum_reactions
  FOR ALL
  USING (
    user_id = auth.uid()
    AND (
      (
        thread_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM forum_threads t
          WHERE t.id = thread_id AND is_community_member(t.community_id)
        )
      )
      OR (
        post_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM forum_posts p
          JOIN forum_threads t ON t.id = p.thread_id
          WHERE p.id = post_id AND is_community_member(t.community_id)
        )
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (
        thread_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM forum_threads t
          WHERE t.id = thread_id AND is_community_member(t.community_id)
        )
      )
      OR (
        post_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM forum_posts p
          JOIN forum_threads t ON t.id = p.thread_id
          WHERE p.id = post_id AND is_community_member(t.community_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users manage own lesson progress" ON lesson_progress;
CREATE POLICY "Users manage own lesson progress" ON lesson_progress
  FOR ALL
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM lessons l
      JOIN courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND is_community_member(c.community_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM lessons l
      JOIN courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND is_community_member(c.community_id)
    )
  );

DROP POLICY IF EXISTS "Users manage own reading progress" ON reading_progress;
CREATE POLICY "Users manage own reading progress" ON reading_progress
  FOR ALL
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM books b
      WHERE b.id = book_id AND is_community_member(b.community_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM books b
      WHERE b.id = book_id AND is_community_member(b.community_id)
    )
  );

DROP POLICY IF EXISTS "Users manage own bookmarks" ON reading_bookmarks;
CREATE POLICY "Users manage own bookmarks" ON reading_bookmarks
  FOR ALL
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM books b
      WHERE b.id = book_id AND is_community_member(b.community_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM books b
      WHERE b.id = book_id AND is_community_member(b.community_id)
    )
  );

-- ---------------------------------------------------------------------------
-- calendar_events: members SELECT; only admins write (no member self-insert)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage events" ON calendar_events;
CREATE POLICY "Admins manage events" ON calendar_events
  FOR INSERT
  WITH CHECK (is_community_admin(community_id) OR is_super_admin());

CREATE POLICY "Admins update events" ON calendar_events
  FOR UPDATE
  USING (is_community_admin(community_id) OR is_super_admin())
  WITH CHECK (is_community_admin(community_id) OR is_super_admin());

CREATE POLICY "Admins delete events" ON calendar_events
  FOR DELETE
  USING (is_community_admin(community_id) OR is_super_admin());
