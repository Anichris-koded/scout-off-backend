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
    if (sql.startsWith('INSERT OR IGNORE INTO EVENTS')) {
      const [type, ledger, txHash, payload] = args;
      if (!this._db._events.find((e) => e.tx_hash === txHash)) {
        this._db._events.push({ type, ledger, tx_hash: txHash, payload });
      }
    } else if (sql.startsWith('INSERT INTO INDEXER_STATE') || sql.startsWith('INSERT OR REPLACE INTO INDEXER_STATE')) {
      const [key, value] = args;
      this._db._state.set(key, value);
    } else if (sql.startsWith('INSERT INTO PLAYERS')) {
      const [player_id, wallet, position, region, metadata_uri, created_at] = args;
      const existing = this._db._players.findIndex((p) => p.player_id === player_id);
      if (existing >= 0) {
        // ON CONFLICT DO UPDATE — update mutable fields
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
    } else if (sql.startsWith('INSERT INTO AUDIT_LOG')) {
      const [action, admin_wallet, query_params, created_at] = args;
      this._db._auditLog.push({
        id: this._db._auditLog.length + 1,
        action,
        admin_wallet,
        query_params,
        created_at,
      });
    } else if (sql.startsWith('INSERT INTO PENDING_PINS')) {
      const [payload, , created_at] = args;
      this._db._pendingPins.push({
        id: this._db._pendingPins.length + 1,
        payload,
        attempts: 0,
        created_at,
        last_tried: null,
      });
    } else if (sql.startsWith('DELETE FROM PENDING_PINS')) {
      const id = args[0];
      this._db._pendingPins = this._db._pendingPins.filter((r) => r.id !== id);
    } else if (sql.startsWith('UPDATE PENDING_PINS')) {
      const [last_tried, id] = args;
      const idx = this._db._pendingPins.findIndex((r) => r.id === id);
      if (idx >= 0) {
        this._db._pendingPins[idx].attempts += 1;
        this._db._pendingPins[idx].last_tried = last_tried;
      }
    } else if (sql.startsWith('INSERT INTO MIGRATIONS')) {
      const [id, applied_at] = args;
      this._db._migrations.set(id, { id, applied_at });
    }
    return { changes: 1, lastInsertRowid: 0 };
  }

  get(...args) {
    const sql = this._sql.toUpperCase();
    if (sql.includes('FROM MIGRATIONS')) {
      const id = args[0];
      return this._db._migrations.get(id) ?? undefined;
    }
    if (sql.includes('INDEXER_STATE')) {
      const key = args[0];
      const value = this._db._state.get(key);
      return value !== undefined ? { value } : undefined;
    }
    if (sql.includes('FROM PLAYERS') && sql.includes('WHERE PLAYER_ID = ?')) {
      return this._db._players.find((p) => p.player_id === args[0]) ?? undefined;
    }
    if (sql.includes('COUNT(*)') && sql.includes('FROM EVENTS')) {
      const rows = sql.includes('WHERE TYPE = ?')
        ? this._db._events.filter((e) => e.type === args[0])
        : this._db._events;
      return { count: rows.length };
    }
    if (sql.includes('COUNT(*)') && sql.includes('FROM AUDIT_LOG')) {
      let rows = [...this._db._auditLog];
      let argIdx = 0;
      const whereMatch = sql.match(/WHERE (.+?)(?:ORDER|$)/);
      if (whereMatch) {
        const conditions = whereMatch[1].split(' AND ');
        for (const cond of conditions) {
          const val = args[argIdx++];
          if (cond.includes('ACTION = ?')) rows = rows.filter((r) => r.action === val);
          else if (cond.includes('CREATED_AT >= ?')) rows = rows.filter((r) => r.created_at >= val);
          else if (cond.includes('CREATED_AT <= ?')) rows = rows.filter((r) => r.created_at <= val);
        }
      }
      return { count: rows.length };
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
        rows = this._db._events.filter((e) => e.type === args[argIdx++]);
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
      // Parse WHERE conditions from remaining args in order
      const whereMatch = sql.match(/WHERE (.+?)(?:ORDER|$)/);
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
      return rows;
    }
    if (sql.includes('FROM AUDIT_LOG')) {
      let rows = [...this._db._auditLog];
      let argIdx = 0;
      const whereMatch = sql.match(/WHERE (.+?)(?:ORDER|LIMIT|$)/);
      if (whereMatch) {
        const conditions = whereMatch[1].trim().split(' AND ');
        for (const cond of conditions) {
          const val = args[argIdx++];
          if (cond.includes('ACTION = ?')) rows = rows.filter((r) => r.action === val);
          else if (cond.includes('CREATED_AT >= ?')) rows = rows.filter((r) => r.created_at >= val);
          else if (cond.includes('CREATED_AT <= ?')) rows = rows.filter((r) => r.created_at <= val);
        }
      }
      if (sql.includes('LIMIT ?')) {
        const limit = args[argIdx++];
        const offset = args[argIdx++] ?? 0;
        rows = rows.slice(offset, offset + limit);
      }
      return rows;
    }
    if (sql.includes('FROM PENDING_PINS')) {
      let rows = [...this._db._pendingPins];
      if (sql.includes('LIMIT ?')) {
        const limit = args[0];
        rows = rows.slice(0, limit);
      }
      return rows;
    }
    return [];
  }
}

class Database {
  constructor(_path) {
    this._events = [];
    this._state = new Map();
    this._players = [];
    this._auditLog = [];
    this._pendingPins = [];
    this._migrations = new Map();
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
