import Database from 'better-sqlite3';
import config from '../config';
import { EventRecord, ContractEventType } from '../types';

// ─── Connection & schema ──────────────────────────────────────────────────────

const db = new Database(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    type      TEXT NOT NULL,
    ledger    INTEGER NOT NULL,
    tx_hash   TEXT NOT NULL UNIQUE,
    payload   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS indexer_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function getDb(): Database.Database {
  return db;
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function getLastLedger(): number {
  const row = db
    .prepare('SELECT value FROM indexer_state WHERE key = ?')
    .get('last_ledger') as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

export function setLastLedger(ledger: number): void {
  db.prepare(
    'INSERT INTO indexer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('last_ledger', String(ledger));
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getEvents(type?: ContractEventType): EventRecord[] {
  const rows = type
    ? (db.prepare('SELECT * FROM events WHERE type = ? ORDER BY ledger ASC').all(type) as any[])
    : (db.prepare('SELECT * FROM events ORDER BY ledger ASC').all() as any[]);

  return rows.map((r) => ({
    source: config.contractId,
    type: r.type as ContractEventType,
    payload: JSON.parse(r.payload),
    contractAddress: config.contractId,
  }));
}
