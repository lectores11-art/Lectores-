-- Migration 005: Track book content pipeline version for re-upload detection
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS pipeline_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN books.pipeline_version IS
  'Version of PDF extract/paginate pipeline; 0 = legacy/corrupt, 1+ = current';
