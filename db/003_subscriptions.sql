-- Migration 003: subscriptions table
-- Tracks active scout subscriptions purchased via the pay-to-subscribe flow.

CREATE TABLE IF NOT EXISTS subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scout       TEXT    NOT NULL,
  tier        TEXT    NOT NULL,
  started_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  tx_hash     TEXT    NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_scout      ON subscriptions (scout);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions (expires_at);
