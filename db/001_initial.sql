-- Migration 001: initial schema
-- Applied automatically by runMigrations() (src/db/migrate.ts) on startup.
-- This file is the canonical reference for the DB schema.

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  type      TEXT    NOT NULL,
  ledger    INTEGER NOT NULL,
  tx_hash   TEXT    NOT NULL UNIQUE,
  payload   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS indexer_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_type   ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_ledger ON events (ledger);
