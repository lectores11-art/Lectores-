-- One-shot: unlock invitees stuck on paywall while Stripe is not connected.
-- Run in Supabase SQL Editor for the Lectores project, then reload /c/.../forum
-- as the second user. No new invite link needed.

UPDATE memberships m
SET
  status = 'active',
  joined_at = COALESCE(joined_at, now()),
  updated_at = now()
FROM communities c
WHERE m.community_id = c.id
  AND c.slug = 'comunity-2-5HRa6y'
  AND m.status IN ('pending', 'cancelled', 'expired')
  AND COALESCE(m.rejoin_blocked, false) = false;
