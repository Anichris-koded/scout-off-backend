import Database from 'better-sqlite3';
import config from '../config';
import { EventRecord, ContractEventType } from '../types';
import { runMigrations } from './migrate';
import { logger } from '../utils/logger';

function slowQueryThresholdMs(): number {
  return parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? '50', 10);
}

/** Runs fn(), logs a warn if it takes longer than SLOW_QUERY_THRESHOLD_MS. */
export function timedQuery<T>(sql: string, fn: () => T): T {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  if (duration >= slowQueryThresholdMs()) {
    logger.warn(`[db] slow query ${duration}ms: ${sql}`);
  }
  return result;
}

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
  if (!_db) throw new Error("Database not initialised — call initDb() first");
  return _db;
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function getLastLedger(): number {
  const sql = 'SELECT value FROM indexer_state WHERE key = ?';
  const row = timedQuery(sql, () =>
    getDb().prepare(sql).get('last_ledger') as { value: string } | undefined
  );
  return row ? parseInt(row.value, 10) : 0;
}

export function setLastLedger(ledger: number): void {
  const sql = 'INSERT INTO indexer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  timedQuery(sql, () => getDb().prepare(sql).run('last_ledger', String(ledger)));
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

export function getEvents(
  type?: ContractEventType,
  opts?: GetEventsOptions,
): EventRecord[] {
  const db = getDb();
  const { limit, offset } = opts ?? {};
  const hasPagination = limit !== undefined && offset !== undefined;

  let sql: string;
  let rows: EventRow[];
  if (type && hasPagination) {
    sql = 'SELECT * FROM events WHERE type = ? ORDER BY ledger ASC LIMIT ? OFFSET ?';
    rows = timedQuery(sql, () => db.prepare(sql).all(type, limit, offset) as EventRow[]);
  } else if (type) {
    sql = 'SELECT * FROM events WHERE type = ? ORDER BY ledger ASC';
    rows = timedQuery(sql, () => db.prepare(sql).all(type) as EventRow[]);
  } else if (hasPagination) {
    sql = 'SELECT * FROM events ORDER BY ledger ASC LIMIT ? OFFSET ?';
    rows = timedQuery(sql, () => db.prepare(sql).all(limit, offset) as EventRow[]);
  } else {
    sql = 'SELECT * FROM events ORDER BY ledger ASC';
    rows = timedQuery(sql, () => db.prepare(sql).all() as EventRow[]);
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
  const sql = type
    ? 'SELECT COUNT(*) AS count FROM events WHERE type = ?'
    : 'SELECT COUNT(*) AS count FROM events';
  const row = type
    ? timedQuery(sql, () => db.prepare(sql).get(type) as { count: number } | undefined)
    : timedQuery(sql, () => db.prepare(sql).get() as { count: number } | undefined);
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
  limit?: number;
  offset?: number;
}

export interface PlayerProfileHistoryRow {
  metadata_uri: string;
  changed_at: number;
  tx_hash: string;
}

export function insertPlayerProfileHistory(p: {
  player_id: string;
  metadata_uri: string;
  changed_at: number;
  tx_hash: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO player_profile_history (player_id, metadata_uri, changed_at, tx_hash)
       VALUES (?, ?, ?, ?)`,
    )
    .run(p.player_id, p.metadata_uri, p.changed_at, p.tx_hash);
}

export function getPlayerProfileHistory(
  playerId: string,
): PlayerProfileHistoryRow[] {
  return getDb()
    .prepare(
      `SELECT metadata_uri, changed_at, tx_hash
       FROM player_profile_history
       WHERE player_id = ?
       ORDER BY changed_at DESC`,
    )
    .all(playerId) as PlayerProfileHistoryRow[];
}

export function upsertPlayer(p: {
  player_id: string;
  wallet: string;
  position?: string;
  region?: string;
  metadata_uri?: string;
  created_at?: number;
}): void {
  const sql = `INSERT INTO players (player_id, wallet, position, region, metadata_uri, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET
         wallet       = excluded.wallet,
         position     = excluded.position,
         region       = excluded.region,
         metadata_uri = excluded.metadata_uri`;
  timedQuery(sql, () =>
    getDb().prepare(sql).run(p.player_id, p.wallet, p.position ?? null, p.region ?? null, p.metadata_uri ?? null, p.created_at ?? null)
  );
}

export function updatePlayerProgress(playerId: string, level: number): void {
  const sql = 'UPDATE players SET progress_level = ? WHERE player_id = ?';
  timedQuery(sql, () => getDb().prepare(sql).run(level, playerId));
}

export function getPlayerById(playerId: string): PlayerRow | null {
  const sql = 'SELECT * FROM players WHERE player_id = ?';
  return timedQuery(sql, () =>
    (getDb().prepare(sql).get(playerId) as PlayerRow | undefined) ?? null
  );
}

function buildPlayerWhereClause(opts: QueryPlayersOptions): { where: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts.region) {
    conditions.push("region = ?");
    params.push(opts.region);
  }
  if (opts.position) {
    conditions.push("position = ?");
    params.push(opts.position);
  }
  if (opts.minTier !== undefined) {
    conditions.push("progress_level >= ?");
    params.push(opts.minTier);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

export function queryPlayers(opts: QueryPlayersOptions): PlayerRow[] {
  const { where, params } = buildPlayerWhereClause(opts);
  const pagination =
    opts.limit !== undefined ? ` LIMIT ? OFFSET ?` : '';
  const sql = `SELECT * FROM players ${where} ORDER BY created_at ASC${pagination}`;
  const allParams: (string | number)[] = pagination
    ? [...params, opts.limit!, opts.offset ?? 0]
    : params;
  return timedQuery(sql, () => getDb().prepare(sql).all(...allParams) as PlayerRow[]);
}

export function countPlayers(opts: Omit<QueryPlayersOptions, 'limit' | 'offset'>): number {
  const { where, params } = buildPlayerWhereClause(opts);
  const sql = `SELECT COUNT(*) AS count FROM players ${where}`;
  const row = timedQuery(sql, () =>
    getDb().prepare(sql).get(...params) as { count: number } | undefined
  );
  return row?.count ?? 0;
}

// ─── Subscription table helpers ───────────────────────────────────────────────

export interface SubscriptionRow {
  id: number;
  scout_wallet: string;
  tier: string;
  expires_at: number;
  cancelled_at: number | null;
  created_at: number;
}

/** Insert a new subscription record and return its id. */
export function insertSubscription(p: {
  scout_wallet: string;
  tier: string;
  expires_at: number;
  created_at: number;
}): number {
  const sql = `INSERT INTO subscriptions (scout_wallet, tier, expires_at, created_at)
               VALUES (?, ?, ?, ?)`;
  const result = timedQuery(sql, () =>
    getDb().prepare(sql).run(p.scout_wallet, p.tier, p.expires_at, p.created_at)
  );
  return result.lastInsertRowid as number;
}

/** Return the latest subscription row for a scout (active or expired, but not cancelled). */
export function getLatestSubscription(scoutWallet: string): SubscriptionRow | null {
  const sql = `SELECT * FROM subscriptions
               WHERE scout_wallet = ? AND cancelled_at IS NULL
               ORDER BY expires_at DESC
               LIMIT 1`;
  return timedQuery(sql, () =>
    (getDb().prepare(sql).get(scoutWallet) as SubscriptionRow | undefined) ?? null
  );
}

/** Extend an existing subscription's expiry and update its tier. */
export function renewSubscription(p: {
  id: number;
  tier: string;
  expires_at: number;
}): void {
  const sql = `UPDATE subscriptions SET tier = ?, expires_at = ? WHERE id = ?`;
  timedQuery(sql, () => getDb().prepare(sql).run(p.tier, p.expires_at, p.id));
}

/** Mark a subscription as cancelled. */
export function cancelSubscription(p: {
  id: number;
  cancelled_at: number;
}): void {
  const sql = `UPDATE subscriptions SET cancelled_at = ? WHERE id = ?`;
  timedQuery(sql, () => getDb().prepare(sql).run(p.cancelled_at, p.id));
}

// ─── Trial offers table helpers ───────────────────────────────────────────────

export interface TrialOfferRow {
  id: number;
  offer_id: string;
  scout_wallet: string;
  player_id: string;
  details_uri: string;
  status: 'pending' | 'accepted' | 'rejected';
  reject_reason: string | null;
  responded_at: number | null;
  created_at: number;
}

/** Insert a new trial offer record. */
export function insertTrialOffer(p: {
  offer_id: string;
  scout_wallet: string;
  player_id: string;
  details_uri: string;
  created_at: number;
}): void {
  const sql = `INSERT OR IGNORE INTO trial_offers (offer_id, scout_wallet, player_id, details_uri, status, created_at)
               VALUES (?, ?, ?, ?, 'pending', ?)`;
  timedQuery(sql, () =>
    getDb().prepare(sql).run(p.offer_id, p.scout_wallet, p.player_id, p.details_uri, p.created_at)
  );
}

/** Fetch a trial offer by its id. */
export function getTrialOfferById(offerId: string): TrialOfferRow | null {
  const sql = `SELECT * FROM trial_offers WHERE offer_id = ?`;
  return timedQuery(sql, () =>
    (getDb().prepare(sql).get(offerId) as TrialOfferRow | undefined) ?? null
  );
}

/** Update a trial offer's status (accept or reject). */
export function respondToTrialOffer(p: {
  offer_id: string;
  status: 'accepted' | 'rejected';
  reject_reason?: string;
  responded_at: number;
}): void {
  const sql = `UPDATE trial_offers
               SET status = ?, reject_reason = ?, responded_at = ?
               WHERE offer_id = ?`;
  timedQuery(sql, () =>
    getDb().prepare(sql).run(p.status, p.reject_reason ?? null, p.responded_at, p.offer_id)
  );
}
