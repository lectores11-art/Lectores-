-- 015: legal consent, book licenses, reports, hide flags
-- Apply in Supabase SQL editor / migration runner. Do not run against prod from the agent.

-- Profiles: consent + residence + erasure marker
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS age_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS residence_country TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_residence_country_len;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_residence_country_len
  CHECK (residence_country IS NULL OR char_length(residence_country) BETWEEN 2 AND 2);

-- Books: copyright category + territories
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS legal_category TEXT,
  ADD COLUMN IF NOT EXISTS license_territories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rights_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS license_expires_at DATE,
  ADD COLUMN IF NOT EXISTS allows_live_display BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allows_recording BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS license_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cover_rights_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE books
  DROP CONSTRAINT IF EXISTS books_legal_category_check;
ALTER TABLE books
  ADD CONSTRAINT books_legal_category_check
  CHECK (
    legal_category IS NULL
    OR legal_category IN ('public_domain', 'open_license', 'rights_holder', 'catalog')
  );

UPDATE books
SET legal_category = 'catalog'
WHERE pdf_storage_path IS NULL AND legal_category IS NULL;

-- Classroom + forum hide + recording attestation
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recording_consent_attested BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE forum_threads
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Reports (DSA notice-and-action minimum)
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('book', 'thread', 'lesson')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hidden', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_community
  ON content_reports (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_status
  ON content_reports (status);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members insert reports" ON content_reports;
CREATE POLICY "Members insert reports" ON content_reports
  FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    AND is_community_member(community_id)
  );

DROP POLICY IF EXISTS "Members view own reports" ON content_reports;
CREATE POLICY "Members view own reports" ON content_reports
  FOR SELECT
  USING (
    reporter_id = auth.uid()
    OR is_community_admin(community_id)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Admins update reports" ON content_reports;
CREATE POLICY "Admins update reports" ON content_reports
  FOR UPDATE
  USING (is_community_admin(community_id) OR is_super_admin())
  WITH CHECK (is_community_admin(community_id) OR is_super_admin());

-- Hide unpublished-from-members content
DROP POLICY IF EXISTS "Members view books" ON books;
CREATE POLICY "Members view books" ON books FOR SELECT
  USING (
    is_community_member(community_id)
    AND (is_published OR is_community_admin(community_id))
    AND (NOT is_hidden OR is_community_admin(community_id))
  );

DROP POLICY IF EXISTS "Members view forum threads" ON forum_threads;
CREATE POLICY "Members view forum threads" ON forum_threads FOR SELECT
  USING (
    is_community_member(community_id)
    AND (NOT is_hidden OR is_community_admin(community_id) OR author_id = auth.uid())
  );

DROP POLICY IF EXISTS "Members view lessons" ON lessons;
CREATE POLICY "Members view lessons" ON lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_id
        AND is_community_member(c.community_id)
        AND (lessons.is_published OR is_community_admin(c.community_id))
        AND (NOT lessons.is_hidden OR is_community_admin(c.community_id))
    )
  );

REVOKE ALL ON content_reports FROM anon;
GRANT SELECT, INSERT, UPDATE ON content_reports TO authenticated;
