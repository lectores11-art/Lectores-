-- Migration 008: Storage bucket for book cover images
-- Public bucket so cover_url can be a stable browser-loadable URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-covers',
  'book-covers',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention: {community_id}/{timestamp}-{filename}

DROP POLICY IF EXISTS "Anyone can read book covers" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can upload book covers" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can update book covers" ON storage.objects;
DROP POLICY IF EXISTS "Community admins can delete book covers" ON storage.objects;

CREATE POLICY "Anyone can read book covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-covers');

CREATE POLICY "Community admins can upload book covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'book-covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Community admins can update book covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'book-covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'book-covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Community admins can delete book covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'book-covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_community_admin(((storage.foldername(name))[1])::uuid)
  );
