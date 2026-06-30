/**
 * tests/utils/migrations.test.ts
 *
 * Verifies that runMigrations():
 *  - applies every pending SQL file in db/ in order
 *  - records each version in schema_migrations
 *  - is idempotent (calling it twice does not error or duplicate entries)
 *  - applies the trial_offers migration (002_trial_offers.sql)
 *  - creates the trial_offers table with the expected columns
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/utils/migrations';

/** Open a fresh mock-backed Database for each test. */
function openDb(): InstanceType<typeof Database> {
  return new (Database as any)(':memory:');
}

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db');

describe('runMigrations', () => {
  it('creates the schema_migrations tracking table', () => {
    const db = openDb();
    runMigrations(db);

    // After runMigrations the mock exec() registers 'schema_migrations' in _createdTables
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      )
      .get('schema_migrations') as { name: string } | undefined;

    expect(row?.name).toBe('schema_migrations');
  });

  it('applies all migration files found in db/', () => {
    const db = openDb();
    runMigrations(db);

    const sqlFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const applied = (
      db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>
    ).map((r) => r.version);

    for (const file of sqlFiles) {
      expect(applied).toContain(file);
    }
  });

  it('applies 002_trial_offers.sql and creates the trial_offers table', () => {
    const db = openDb();
    runMigrations(db);

    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='trial_offers'"
      )
      .get('trial_offers') as { name: string } | undefined;

    expect(row?.name).toBe('trial_offers');
  });

  it('is idempotent — calling runMigrations twice does not throw', () => {
    const db = openDb();
    expect(() => {
      runMigrations(db);
      runMigrations(db); // second call must be a no-op
    }).not.toThrow();
  });

  it('does not re-apply already applied migrations', () => {
    const db = openDb();
    runMigrations(db);

    const countBefore = (
      db
        .prepare('SELECT COUNT(*) as cnt FROM schema_migrations')
        .get() as { cnt: number }
    ).cnt;

    runMigrations(db); // second run — must be a no-op

    const countAfter = (
      db
        .prepare('SELECT COUNT(*) as cnt FROM schema_migrations')
        .get() as { cnt: number }
    ).cnt;

    expect(countAfter).toBe(countBefore);
  });

  it('trial_offers table has the expected columns', () => {
    const db = openDb();
    runMigrations(db);

    const columns = (
      db.prepare('PRAGMA table_info(trial_offers)').all() as Array<{ name: string }>
    ).map((c) => c.name);

    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'scout',
        'player_id',
        'details_uri',
        'ledger',
        'tx_hash',
        'created_at',
      ])
    );
  });
});
