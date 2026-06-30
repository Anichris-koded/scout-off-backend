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
    } else if (sql.startsWith('INSERT OR REPLACE INTO VALIDATORS')) {
      // args: wallet, registered_at, tx_hash
      const [wallet, registered_at, tx_hash] = args;
      const idx = this._db._validators.findIndex((v) => v.wallet === wallet);
      if (idx >= 0) {
        this._db._validators[idx] = { wallet, registered_at, revoked_at: null, tx_hash };
      } else {
        this._db._validators.push({ wallet, registered_at, revoked_at: null, tx_hash });
      }
    } else if (sql.startsWith('UPDATE VALIDATORS SET REVOKED_AT')) {
      // args: revoked_at, tx_hash, wallet
      const [revoked_at, tx_hash, wallet] = args;
      const row = this._db._validators.find((v) => v.wallet === wallet);
      if (row) {
        row.revoked_at = revoked_at;
        row.tx_hash = tx_hash;
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
    if (sql.includes('FROM VALIDATORS')) {
      return [...this._db._validators].sort((a, b) => b.registered_at - a.registered_at);
    }
    return [];
  }
}

class Database {
  constructor(_path) {
    this._events = [];
    this._state = new Map();
    this._validators = [];
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
