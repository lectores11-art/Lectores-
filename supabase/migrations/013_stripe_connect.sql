-- Stripe Connect: one connected account per community + commission clock.

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS commission_starts_at TIMESTAMPTZ;

UPDATE communities
SET commission_starts_at = COALESCE(created_at, NOW())
WHERE commission_starts_at IS NULL;

ALTER TABLE communities
  ALTER COLUMN commission_starts_at SET DEFAULT NOW();

ALTER TABLE communities
  ALTER COLUMN commission_starts_at SET NOT NULL;

COMMENT ON COLUMN communities.stripe_account_id IS
  'Connected Stripe account (acct_...) for this community owner. Direct charges.';
COMMENT ON COLUMN communities.stripe_charges_enabled IS
  'True after the owner finishes Stripe onboarding (charges_enabled).';
COMMENT ON COLUMN communities.commission_starts_at IS
  'Start of the 60/40/20/0 platform fee windows (30 days each).';
