-- Migration 011: explicit REVOKE anon on SECURITY DEFINER helpers
-- (010 REVOKE FROM PUBLIC left prior direct grants to anon intact)

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_community_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_community_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_community_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_community_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.lookup_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_invite_by_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.protect_super_admin_flag() FROM PUBLIC, anon, authenticated;
