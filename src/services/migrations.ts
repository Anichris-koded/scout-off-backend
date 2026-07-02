import fs from 'fs';
import path from 'path';

export function runMigrations(db: { exec(sql: string): void }, migrationsDir = path.resolve(__dirname, '../../db')): void {
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const fileName of files) {
    const filePath = path.join(migrationsDir, fileName);
    const sql = fs.readFileSync(filePath, 'utf8');
    db.exec(sql);
  }
}
