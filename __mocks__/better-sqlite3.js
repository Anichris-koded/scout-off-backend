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
    } else if (sql.includes('INSERT') && sql.includes('INDEXER_STATE') && sql.includes('ON CONFLICT')) {
      const [key, value] = args;
      this._db._state.set(key, value);
    } else if (sql.startsWith('INSERT OR IGNORE INTO REVOKED_TOKENS')) {
      const [jti, revokedAt, expiresAt] = args;
      if (!this._db._revokedTokens.has(jti)) {
        this._db._revokedTokens.set(jti, { jti, revoked_at: revokedAt, expires_at: expiresAt });
      }
    } else if (sql.startsWith('DELETE FROM REVOKED_TOKENS')) {
      const [now] = args;
      for (const [jti, row] of this._db._revokedTokens) {
        if (row.expires_at <= now) {
          this._db._revokedTokens.delete(jti);
        }
      }
    }
    return { changes: 1, lastInsertRowid: 0 };
  }

  get(...args) {
    const sql = this._sql.toUpperCase();
    if (sql.includes('INDEXER_STATE')) {
      const key = args[0];
      const value = this._db._state.get(key);
      return value !== undefined ? { value } : undefined;
    }
    if (sql.includes('FROM REVOKED_TOKENS') && sql.includes('WHERE JTI = ?')) {
      const jti = args[0];
      return this._db._revokedTokens.has(jti) ? { 1: 1 } : undefined;
    }
    return undefined;
  }

  all(...args) {
    const sql = this._sql.toUpperCase();
    if (sql.includes('FROM EVENTS')) {
      if (sql.includes('WHERE TYPE = ?')) {
        return this._db._events.filter((e) => e.type === args[0]);
      }
      return [...this._db._events];
    }
    return [];
  }
}

class Database {
  constructor(_path) {
    this._events = [];
    this._state = new Map();
    this._revokedTokens = new Map();
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
