-- Migration 007: Enforce private books bucket + path-scoped storage RLS (S2-07)
-- Idempotent. Complements 003/004 — ensures public=false and tight policies.

UPDATE storage.buckets
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'books';

DROP POLICY IF EXISTS "Community members can read book files" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can upload book files" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can delete book files" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can update book files" ON storage.objects;

-- Path convention: {community_id}/{filename}.pdf
CREATE POLICY "Community members can read book files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Community admins can upload book files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Community admins can update book files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Community admins can delete book files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );
