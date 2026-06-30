/**
 * src/utils/migrations.ts
 *
 * Applies numbered SQL migration files from the `db/` directory in order.
 * Each migration is recorded in a `schema_migrations` table so it is only
 * ever applied once (idempotent).
 *
 * Naming convention:  db/<NNN>_<description>.sql
 * Example:            db/001_initial.sql
 *                     db/002_trial_offers.sql
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/** Directory that holds the numbered migration files. */
const MIGRATIONS_DIR = path.resolve(__dirname, '../../db');

/**
 * Ensures the `schema_migrations` tracking table exists.
 */
function ensureMigrationsTable(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT    PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
}

/**
 * Returns the set of migration versions that have already been applied.
 */
function appliedVersions(db: InstanceType<typeof Database>): Set<string> {
  const rows = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: string }>;
  return new Set(rows.map((r) => r.version));
}

/**
 * Runs every pending `.sql` migration in `db/` in ascending filename order.
 *
 * @param db - An open better-sqlite3 Database instance.
 */
export function runMigrations(db: InstanceType<typeof Database>): void {
  ensureMigrationsTable(db);
  const applied = appliedVersions(db);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order preserves 001 < 002 < … ordering

  for (const file of files) {
    if (applied.has(file)) continue; // already applied — skip

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Run the migration and record it atomically.
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (version) VALUES (?)'
      ).run(file);
    });

    applyMigration();
  }
}
