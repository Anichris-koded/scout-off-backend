import Database from 'better-sqlite3';
import { runMigrations } from '../../src/services/migrations';

describe('runMigrations', () => {
  it('applies SQL migrations and creates the contact_unlocks table', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contact_unlocks'")
      .get() as { name: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.name).toBe('contact_unlocks');
  });

  it('is idempotent when run multiple times', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    runMigrations(db);

    const count = db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='contact_unlocks'")
      .get() as { count: number };

    expect(count.count).toBe(1);
  });
});
