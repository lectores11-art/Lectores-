-- Migration 017: meeting shared book display mode (cover | reader | none)

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS book_display_mode TEXT NOT NULL DEFAULT 'none';

ALTER TABLE meetings
  DROP CONSTRAINT IF EXISTS meetings_book_display_mode_check;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_book_display_mode_check
  CHECK (book_display_mode IN ('none', 'cover', 'reader'));

COMMENT ON COLUMN meetings.book_display_mode IS
  'Shared stage for all participants: none, cover (cover_url only), or reader (BookReader)';
