/**
 * Manual Jest mock for better-sqlite3.
 * Provides a minimal in-memory SQL-like interface so tests can run without
 * the native binary (which requires a matching Node ABI).
 */

class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql.trim();
  }

  run(...args) {
    const sql = this._sql.toUpperCase();

    // ── events ──────────────────────────────────────────────────────────────
    if (sql.startsWith('INSERT OR IGNORE INTO EVENTS')) {
      const [type, ledger, txHash, payload] = args;
      if (!this._db._events.find((e) => e.tx_hash === txHash)) {
        this._db._events.push({ type, ledger, tx_hash: txHash, payload });
      }
    }

    // ── migrations ──────────────────────────────────────────────────────────
    else if (sql.startsWith('INSERT INTO MIGRATIONS')) {
      const [id, appliedAt] = args;
      this._db._migrations.set(id, { id, applied_at: appliedAt });
    }

    // ── indexer_state ───────────────────────────────────────────────────────
    else if (
      sql.startsWith('INSERT INTO INDEXER_STATE') ||
      sql.startsWith('INSERT OR REPLACE INTO INDEXER_STATE') ||
      (sql.startsWith('INSERT INTO INDEXER_STATE') && sql.includes('ON CONFLICT'))
    ) {
      const [key, value] = args;
      this._db._state.set(key, value);
    }

    // ── players ─────────────────────────────────────────────────────────────
    else if (sql.startsWith('INSERT INTO PLAYERS')) {
      const [player_id, wallet, position, region, metadata_uri, created_at] = args;
      const existing = this._db._players.findIndex((p) => p.player_id === player_id);
      if (existing >= 0) {
        this._db._players[existing] = {
          ...this._db._players[existing],
          wallet,
          position,
          region,
          metadata_uri,
        };
      } else {
        this._db._players.push({ player_id, wallet, position, region, metadata_uri, progress_level: 0, created_at });
      }
    } else if (sql.startsWith('UPDATE PLAYERS SET PROGRESS_LEVEL')) {
      const [level, player_id] = args;
      const idx = this._db._players.findIndex((p) => p.player_id === player_id);
      if (idx >= 0) this._db._players[idx].progress_level = level;
    }

    // ── subscriptions ────────────────────────────────────────────────────────
    else if (sql.startsWith('INSERT INTO SUBSCRIPTIONS')) {
      const [scout_wallet, tier, expires_at, created_at] = args;
      const id = this._db._subIdSeq++;
      this._db._subscriptions.push({ id, scout_wallet, tier, expires_at, cancelled_at: null, created_at });
      return { changes: 1, lastInsertRowid: id };
    } else if (sql.startsWith('UPDATE SUBSCRIPTIONS SET TIER')) {
      // renewSubscription: SET tier = ?, expires_at = ? WHERE id = ?
      const [tier, expires_at, id] = args;
      const idx = this._db._subscriptions.findIndex((s) => s.id === id);
      if (idx >= 0) {
        this._db._subscriptions[idx].tier = tier;
        this._db._subscriptions[idx].expires_at = expires_at;
      }
    } else if (sql.startsWith('UPDATE SUBSCRIPTIONS SET CANCELLED_AT')) {
      // cancelSubscription: SET cancelled_at = ? WHERE id = ?
      const [cancelled_at, id] = args;
      const idx = this._db._subscriptions.findIndex((s) => s.id === id);
      if (idx >= 0) this._db._subscriptions[idx].cancelled_at = cancelled_at;
    }

    // ── trial_offers ─────────────────────────────────────────────────────────
    else if (sql.startsWith('INSERT OR IGNORE INTO TRIAL_OFFERS')) {
      const [offer_id, scout_wallet, player_id, details_uri, status, created_at] = args;
      if (!this._db._trialOffers.find((o) => o.offer_id === offer_id)) {
        const id = this._db._offerIdSeq++;
        this._db._trialOffers.push({
          id, offer_id, scout_wallet, player_id, details_uri,
          status: status ?? 'pending', reject_reason: null, responded_at: null, created_at,
        });
      }
    } else if (sql.startsWith('UPDATE TRIAL_OFFERS')) {
      // respondToTrialOffer: SET status = ?, reject_reason = ?, responded_at = ? WHERE offer_id = ?
      const [status, reject_reason, responded_at, offer_id] = args;
      const idx = this._db._trialOffers.findIndex((o) => o.offer_id === offer_id);
      if (idx >= 0) {
        this._db._trialOffers[idx].status = status;
        this._db._trialOffers[idx].reject_reason = reject_reason;
        this._db._trialOffers[idx].responded_at = responded_at;
      }
    }

    // ── player_profile_history ────────────────────────────────────────────────
    else if (sql.startsWith('INSERT INTO PLAYER_PROFILE_HISTORY')) {
      const [player_id, metadata_uri, changed_at, tx_hash] = args;
      this._db._profileHistory.push({ player_id, metadata_uri, changed_at, tx_hash });
    }

    return { changes: 1, lastInsertRowid: 0 };
  }

  get(...args) {
    const sql = this._sql.toUpperCase();

    // migrations
    if (sql.includes('FROM MIGRATIONS')) {
      const id = args[0];
      return this._db._migrations.get(id) ?? undefined;
    }

    // indexer_state
    if (sql.includes('INDEXER_STATE')) {
      const key = args[0];
      const value = this._db._state.get(key);
      return value !== undefined ? { value } : undefined;
    }

    // players by player_id
    if (sql.includes('FROM PLAYERS') && sql.includes('WHERE PLAYER_ID = ?')) {
      return this._db._players.find((p) => p.player_id === args[0]) ?? undefined;
    }

    // events count
    if (sql.includes('COUNT(*)') && sql.includes('FROM EVENTS')) {
      const rows = sql.includes('WHERE TYPE = ?')
        ? this._db._events.filter((e) => e.type === args[0])
        : this._db._events;
      return { count: rows.length };
    }

    // players count
    if (sql.includes('COUNT(*)') && sql.includes('FROM PLAYERS')) {
      let rows = [...this._db._players];
      const whereMatch = sql.match(/WHERE (.+?)(?:ORDER|LIMIT|$)/);
      if (whereMatch) {
        const conditions = whereMatch[1].split(' AND ');
        let argIdx = 0;
        for (const cond of conditions) {
          const val = args[argIdx++];
          if (cond.includes('REGION = ?')) rows = rows.filter((r) => r.region === val);
          else if (cond.includes('POSITION = ?')) rows = rows.filter((r) => r.position === val);
          else if (cond.includes('PROGRESS_LEVEL >= ?')) rows = rows.filter((r) => r.progress_level >= val);
        }
      }
      return { count: rows.length };
    }

    // subscriptions — getLatestSubscription
    if (sql.includes('FROM SUBSCRIPTIONS') && sql.includes('WHERE SCOUT_WALLET = ?')) {
      const scout_wallet = args[0];
      const rows = this._db._subscriptions
        .filter((s) => s.scout_wallet === scout_wallet && s.cancelled_at === null)
        .sort((a, b) => b.expires_at - a.expires_at);
      return rows[0] ?? undefined;
    }

    // trial_offers — getTrialOfferById
    if (sql.includes('FROM TRIAL_OFFERS') && sql.includes('WHERE OFFER_ID = ?')) {
      return this._db._trialOffers.find((o) => o.offer_id === args[0]) ?? undefined;
    }

    return undefined;
  }

  all(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.includes('FROM MIGRATIONS')) {
      return [...this._db._migrations.values()];
    }

    if (sql.includes('FROM EVENTS')) {
      let rows;
      let argIdx = 0;
      if (sql.includes('WHERE TYPE = ?')) {
        // NB: read the bound arg once, outside the filter callback. Evaluating
        // `args[argIdx++]` per-element (the previous form) advanced argIdx for
        // every row, so only the first row compared against the real value.
        const wanted = args[argIdx++];
        rows = this._db._events.filter((e) => e.type === wanted);
      } else {
        rows = [...this._db._events];
      }
      if (sql.includes('LIMIT ?')) {
        const limit = args[argIdx++];
        const offset = args[argIdx++] ?? 0;
        rows = rows.slice(offset, offset + limit);
      }
      return rows;
    }

    if (sql.includes('FROM PLAYERS')) {
      let rows = [...this._db._players];
      const whereMatch = sql.match(/WHERE (.+?)(?:ORDER|LIMIT|$)/);
      if (whereMatch) {
        const conditions = whereMatch[1].split(' AND ');
        let argIdx = 0;
        for (const cond of conditions) {
          const val = args[argIdx++];
          if (cond.includes('REGION = ?')) rows = rows.filter((r) => r.region === val);
          else if (cond.includes('POSITION = ?')) rows = rows.filter((r) => r.position === val);
          else if (cond.includes('PROGRESS_LEVEL >= ?')) rows = rows.filter((r) => r.progress_level >= val);
        }
      }
      if (sql.includes('LIMIT ?')) {
        const limit = args[args.length - 2];
        const offset = args[args.length - 1] ?? 0;
        rows = rows.slice(offset, offset + limit);
      }
      return rows;
    }

    if (sql.includes('FROM PLAYER_PROFILE_HISTORY')) {
      const player_id = args[0];
      return this._db._profileHistory
        .filter((r) => r.player_id === player_id)
        .sort((a, b) => b.changed_at - a.changed_at);
    }

    return [];
  }
}

class Database {
  constructor(_path) {
    this._events = [];
    this._state = new Map();
    this._players = [];
    this._migrations = new Map();
    this._profileHistory = [];
    this._subscriptions = [];
    this._subIdSeq = 1;
    this._trialOffers = [];
    this._offerIdSeq = 1;
  }

  exec(_sql) {
    // no-op: CREATE TABLE statements are ignored
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  transaction(fn) {
    return (...args) => fn(...args);
  }

  close() {}
}

module.exports = Database;
