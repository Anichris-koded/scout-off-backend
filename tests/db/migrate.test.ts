import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/migrate';

describe('runMigrations', () => {
  it('applies 001_initial.sql on first run', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toContain('001_initial.sql');
  });

  it('is idempotent — running twice applies each migration exactly once', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);
    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    const ids = rows.map((r) => r.id);

    expect(ids).toContain('001_initial.sql');
    // No duplicate entries
    expect(new Set(ids).size).toBe(ids.length);
  });
});
