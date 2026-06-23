import Database from 'better-sqlite3';
import config from '../config';
import { EventRecord, ContractEventType } from '../types';
import { runMigrations } from './migrate';

// ─── Connection & schema ──────────────────────────────────────────────────────

let _db: Database.Database | null = null;

/**
 * Initialise the database connection and run pending migrations.
 * Must be called once at application startup before any query helper is used.
 * Safe to call in tests with DB_PATH=:memory: set before import.
 */
export function initDb(): void {
  _db = new Database(config.dbPath);
  _db.exec(`
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
    CREATE TABLE IF NOT EXISTS players (
      player_id      TEXT    PRIMARY KEY,
      wallet         TEXT    NOT NULL,
      position       TEXT,
      region         TEXT,
      metadata_uri   TEXT,
      progress_level INTEGER DEFAULT 0,
      created_at     INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_players_region   ON players (region);
    CREATE INDEX IF NOT EXISTS idx_players_position ON players (position);
    CREATE INDEX IF NOT EXISTS idx_players_tier     ON players (progress_level);
  `);
}

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialised — call initDb() first');
  return _db;
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function getLastLedger(): number {
  const row = getDb()
    .prepare('SELECT value FROM indexer_state WHERE key = ?')
    .get('last_ledger') as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

export function setLastLedger(ledger: number): void {
  getDb().prepare(
    'INSERT INTO indexer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('last_ledger', String(ledger));
}

// ─── Query helpers ────────────────────────────────────────────────────────────

interface EventRow {
  type: string;
  payload: string;
}

export interface GetEventsOptions {
  limit?: number;
  offset?: number;
}

export function getEvents(type?: ContractEventType, opts?: GetEventsOptions): EventRecord[] {
  const db = getDb();
  const { limit, offset } = opts ?? {};
  const hasPagination = limit !== undefined && offset !== undefined;

  let rows: EventRow[];
  if (type && hasPagination) {
    rows = db.prepare('SELECT * FROM events WHERE type = ? ORDER BY ledger ASC LIMIT ? OFFSET ?').all(type, limit, offset) as EventRow[];
  } else if (type) {
    rows = db.prepare('SELECT * FROM events WHERE type = ? ORDER BY ledger ASC').all(type) as EventRow[];
  } else if (hasPagination) {
    rows = db.prepare('SELECT * FROM events ORDER BY ledger ASC LIMIT ? OFFSET ?').all(limit, offset) as EventRow[];
  } else {
    rows = db.prepare('SELECT * FROM events ORDER BY ledger ASC').all() as EventRow[];
  }

  return rows.map((r) => ({
    source: config.contractId,
    type: r.type as ContractEventType,
    payload: JSON.parse(r.payload),
    contractAddress: config.contractId,
  }));
}

export function getEventsCount(type?: ContractEventType): number {
  const db = getDb();
  const row = type
    ? db.prepare('SELECT COUNT(*) AS count FROM events WHERE type = ?').get(type) as { count: number } | undefined
    : db.prepare('SELECT COUNT(*) AS count FROM events').get() as { count: number } | undefined;
  return row?.count ?? 0;
}

// ─── Player table helpers ─────────────────────────────────────────────────────

export interface PlayerRow {
  player_id: string;
  wallet: string;
  position: string | null;
  region: string | null;
  metadata_uri: string | null;
  progress_level: number;
  created_at: number | null;
}

export interface QueryPlayersOptions {
  region?: string;
  position?: string;
  minTier?: number;
}

export function upsertPlayer(p: {
  player_id: string;
  wallet: string;
  position?: string;
  region?: string;
  metadata_uri?: string;
  created_at?: number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO players (player_id, wallet, position, region, metadata_uri, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET
         wallet       = excluded.wallet,
         position     = excluded.position,
         region       = excluded.region,
         metadata_uri = excluded.metadata_uri`
    )
    .run(p.player_id, p.wallet, p.position ?? null, p.region ?? null, p.metadata_uri ?? null, p.created_at ?? null);
}

export function updatePlayerProgress(playerId: string, level: number): void {
  getDb()
    .prepare('UPDATE players SET progress_level = ? WHERE player_id = ?')
    .run(level, playerId);
}

export function getPlayerById(playerId: string): PlayerRow | null {
  return (
    getDb()
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined
  ) ?? null;
}

export function queryPlayers(opts: QueryPlayersOptions = {}): PlayerRow[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.region) {
    conditions.push('region = ?');
    params.push(opts.region);
  }
  if (opts.position) {
    conditions.push('position = ?');
    params.push(opts.position);
  }
  if (opts.minTier !== undefined) {
    conditions.push('progress_level >= ?');
    params.push(opts.minTier);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return getDb()
    .prepare(`SELECT * FROM players ${where} ORDER BY created_at ASC`)
    .all(...params) as PlayerRow[];
}
