import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db');

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         TEXT    PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = db
      .prepare('SELECT id FROM migrations WHERE id = ?')
      .get(file);

    if (already) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)').run(
        file,
        Date.now()
      );
    })();
  }
}
