import Database from 'better-sqlite3';
import { runMigrations } from '../../src/db/migrate';

describe('runMigrations', () => {
  it('applies 001_initial.sql on first run', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toContain('001_initial.sql');
  });

  it('applies 003_subscriptions.sql and creates the subscriptions table', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toContain('003_subscriptions.sql');

    // Table must exist and be queryable
    expect(() => db.prepare('SELECT * FROM subscriptions LIMIT 0').all()).not.toThrow();
  });

  it('applies 004_validators.sql and creates the validators table (#290)', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toContain('004_validators.sql');

    expect(() => db.prepare('SELECT * FROM validators LIMIT 0').all()).not.toThrow();
  });

  it('applies 005_contact_unlocks.sql and creates the contact_unlocks table (#284)', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    expect(rows.map((r) => r.id)).toContain('005_contact_unlocks.sql');

    expect(() => db.prepare('SELECT * FROM contact_unlocks LIMIT 0').all()).not.toThrow();
  });

  it('is idempotent — running twice applies each migration exactly once', () => {
    const db = new (Database as any)(':memory:');

    runMigrations(db);
    runMigrations(db);

    const rows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
    const ids = rows.map((r) => r.id);

    expect(ids).toContain('001_initial.sql');
    expect(ids).toContain('003_subscriptions.sql');
    expect(ids).toContain('004_validators.sql');
    expect(ids).toContain('005_contact_unlocks.sql');
    // No duplicate entries
    expect(new Set(ids).size).toBe(ids.length);
  });
});
