-- Migration 002: contact unlocks table

CREATE TABLE IF NOT EXISTS contact_unlocks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scout        TEXT    NOT NULL,
  player_id    TEXT    NOT NULL,
  unlocked_at  INTEGER NOT NULL,
  tx_hash      TEXT    NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_contact_unlocks_scout     ON contact_unlocks (scout);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_player_id ON contact_unlocks (player_id);
