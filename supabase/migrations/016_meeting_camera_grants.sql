-- Migration 016: meeting camera grants (host + up to 2 guests)
-- Guests request a publish slot; API enforces max 2 non-host grants per meeting.

CREATE TABLE IF NOT EXISTS meeting_camera_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS meeting_camera_grants_meeting_idx
  ON meeting_camera_grants (meeting_id);

COMMENT ON TABLE meeting_camera_grants IS
  'Non-host users allowed to publish camera/mic in a live meeting (max 2 enforced in API)';

ALTER TABLE meeting_camera_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view camera grants"
  ON meeting_camera_grants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_id AND is_community_member(m.community_id)
    )
  );

-- Inserts/deletes go through service role / API with user session via Supabase client
-- and membership checks in Next.js. Allow members to manage only their own row
-- (cupo still enforced in API before insert).
CREATE POLICY "Members insert own camera grant"
  ON meeting_camera_grants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_id
        AND m.status = 'live'
        AND is_community_member(m.community_id)
    )
  );

CREATE POLICY "Members delete own camera grant"
  ON meeting_camera_grants FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_id AND is_community_admin(m.community_id)
    )
  );
