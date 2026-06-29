-- Migration 004: validators table (#290)
-- Tracks admin-registered validators (coaches, academy directors, etc.)

CREATE TABLE IF NOT EXISTS validators (
  wallet       TEXT    PRIMARY KEY,
  registered_at INTEGER NOT NULL,
  revoked_at   INTEGER
);
