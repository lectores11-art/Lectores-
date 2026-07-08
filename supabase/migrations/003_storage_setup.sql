-- Migration 003: Storage bucket setup for book PDFs
-- Run this in Supabase SQL Editor after 001 and 002

-- Create the books storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'books',
  'books',
  false,
  52428800, -- 50 MB max per PDF
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated community members to read PDFs
CREATE POLICY IF NOT EXISTS "Community members can read book files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
  );

-- Allow community admins (owners) to upload PDFs
CREATE POLICY IF NOT EXISTS "Community admins can upload book files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
  );

-- Allow community admins to delete PDFs
CREATE POLICY IF NOT EXISTS "Community admins can delete book files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'books'
    AND auth.role() = 'authenticated'
  );
