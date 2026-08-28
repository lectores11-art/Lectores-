-- Protect Connect billing columns + unique connected account.

CREATE UNIQUE INDEX IF NOT EXISTS communities_stripe_account_id_uidx
  ON communities (stripe_account_id);

CREATE OR REPLACE FUNCTION protect_community_connect_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
     OR NEW.commission_starts_at IS DISTINCT FROM OLD.commission_starts_at THEN
    -- JWT clients (dueña included) must not rewrite the fee clock or acct_.
    -- service_role / postgres (Connect route, cron, platform admin, SQL) may.
    IF coalesce(auth.role(), '') = 'authenticated' THEN
      RAISE EXCEPTION 'Connect billing columns cannot be changed by authenticated clients';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_community_connect_fields ON communities;
CREATE TRIGGER trg_protect_community_connect_fields
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION protect_community_connect_fields();

REVOKE ALL ON FUNCTION public.protect_community_connect_fields()
  FROM PUBLIC, anon, authenticated;
