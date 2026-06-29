-- Migration: add created_at to events table for correct date filtering (#302)
-- ALTER TABLE with ADD COLUMN is safe and idempotent via the migration runner.
ALTER TABLE events ADD COLUMN created_at INTEGER;
