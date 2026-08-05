-- Migration 009: Store viewport metrics used for DOM page packing.
-- When the reader opens on a much larger/smaller screen, we re-pack.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS pack_metrics JSONB;

COMMENT ON COLUMN books.pack_metrics IS
  'Viewport used for last DOM pack: {widthPx,leftHeightPx,rightHeightPx,fontSize}';
