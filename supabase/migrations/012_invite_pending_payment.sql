-- Invite join creates a pending membership. Community access opens when Stripe
-- marks the subscription paid (checkout.session.completed), not at signup.
-- already_member covers active OR pending so a shared launch link is not burned twice.

DROP FUNCTION IF EXISTS public.accept_invite(text);

CREATE FUNCTION public.accept_invite(p_token text)
RETURNS TABLE (
  community_slug text,
  already_member boolean,
  membership_status membership_status
)
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

  SELECT slug INTO v_slug FROM communities WHERE id = v_invite.community_id;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;

  SELECT * INTO v_existing
  FROM memberships
  WHERE user_id = v_uid AND community_id = v_invite.community_id;

  IF FOUND AND COALESCE(v_existing.rejoin_blocked, false) THEN
    RAISE EXCEPTION 'membership revoked';
  END IF;

  -- Returning visitors keep their slot; do not consume another use.
  IF FOUND AND v_existing.status IN ('active', 'pending') THEN
    community_slug := v_slug;
    already_member := TRUE;
    membership_status := v_existing.status;
    RETURN NEXT;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE memberships
    SET status = 'pending',
        role = 'member',
        rejoin_blocked = false,
        joined_at = NULL,
        updated_at = NOW()
    WHERE id = v_existing.id;

    community_slug := v_slug;
    already_member := TRUE;
    membership_status := 'pending';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invite max uses reached';
  END IF;

  INSERT INTO memberships (user_id, community_id, role, status, joined_at, rejoin_blocked)
  VALUES (v_uid, v_invite.community_id, 'member', 'pending', NULL, false);

  UPDATE invites
  SET use_count = use_count + 1
  WHERE id = v_invite.id;

  community_slug := v_slug;
  already_member := FALSE;
  membership_status := 'pending';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

COMMENT ON FUNCTION public.accept_invite(text) IS
  'Validates invite token and creates/restores a pending membership. Access is granted after paid Stripe subscription.';
