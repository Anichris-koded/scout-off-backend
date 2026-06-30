-- Migration 002: trial_offers table
-- Persists on-chain trial offer records for queryable history.

CREATE TABLE IF NOT EXISTS trial_offers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scout_wallet TEXT    NOT NULL,
  player_id    TEXT    NOT NULL,
  details_uri  TEXT    NOT NULL,
  tx_hash      TEXT    NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trial_offers_scout ON trial_offers (scout_wallet);
CREATE INDEX IF NOT EXISTS idx_trial_offers_player ON trial_offers (player_id);
