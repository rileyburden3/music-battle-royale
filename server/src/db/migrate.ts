import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from './index.js';
import { seedDemoSongs } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log('🗄️  Running database migrations...');
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Schema applied');

  console.log('🌱 Seeding demo songs...');
  await seedDemoSongs();
  console.log('✅ Done');

  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
