-- Migration 010: security follow-up after live Supabase audit
-- - books.pack_metrics (was 009, missing on remote)
-- - memberships.rejoin_blocked + accept_invite refuses kicked users
-- - tighten EXECUTE grants / search_path on SECURITY DEFINER helpers

-- ---------------------------------------------------------------------------
-- 009 leftover: pack metrics for reader reflow
-- ---------------------------------------------------------------------------
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS pack_metrics JSONB;

COMMENT ON COLUMN books.pack_metrics IS
  'Viewport used for last DOM pack: {widthPx,leftHeightPx,rightHeightPx,fontSize}';

-- ---------------------------------------------------------------------------
-- Block invite rejoin after admin kick (leave stays rejoinable)
-- ---------------------------------------------------------------------------
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS rejoin_blocked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN memberships.rejoin_blocked IS
  'When true (admin kick), accept_invite must not reactivate this membership';

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

  IF FOUND AND COALESCE(v_existing.rejoin_blocked, false) THEN
    RAISE EXCEPTION 'membership revoked';
  END IF;

  IF FOUND THEN
    UPDATE memberships
    SET status = 'active',
        role = 'member',
        rejoin_blocked = false,
        joined_at = NOW(),
        updated_at = NOW()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO memberships (user_id, community_id, role, status, joined_at, rejoin_blocked)
    VALUES (v_uid, v_invite.community_id, 'member', 'active', NOW(), false);
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

-- ---------------------------------------------------------------------------
-- Helpers: immutable search_path + revoke anon/public where not needed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION is_community_admin(p_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND community_id = p_community_id
      AND role IN ('community_owner')
      AND status = 'active'
  ) OR is_super_admin() OR EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND community_id = p_community_id
      AND status = 'active'
  ) OR is_super_admin() OR EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION get_user_community_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT community_id FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  UNION
  SELECT id FROM communities WHERE owner_id = auth.uid()
  UNION
  SELECT id FROM communities WHERE is_super_admin();
$$;

-- Trigger-only: must not be callable via PostgREST
REVOKE ALL ON FUNCTION handle_new_user() FROM PUBLIC;

REVOKE ALL ON FUNCTION is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION is_community_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_community_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION is_community_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_community_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION get_user_community_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_community_ids() TO authenticated;

-- Invite landing may call lookup before login (or via service_role in API)
REVOKE ALL ON FUNCTION lookup_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_invite_by_token(text) TO anon, authenticated;
