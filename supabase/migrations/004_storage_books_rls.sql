-- Migration 004: Fix storage RLS for books bucket (paths: {community_id}/filename.pdf)
-- Run in Supabase SQL Editor if uploads fail with "row-level security policy".

DROP POLICY IF EXISTS "Community members can read book files" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can upload book files" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can delete book files" ON storage.objects;

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

CREATE POLICY "Community admins can delete book files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );
