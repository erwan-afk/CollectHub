/**
 * One-off: adds a unique constraint on (organization_id, file_hash) in invoices.
 * Replaces the plain index idx_invoices_file_hash with a unique one so the DB
 * rejects concurrent duplicate uploads atomically (TOCTOU-safe).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop the plain index first (can't create unique if plain already exists with same name)
    await client.query(`DROP INDEX IF EXISTS idx_invoices_file_hash`);

    // Unique partial index: only when file_hash IS NOT NULL
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_org_file_hash
        ON invoices(organization_id, file_hash)
        WHERE file_hash IS NOT NULL
    `);

    await client.query('COMMIT');
    console.log('Unique constraint on (organization_id, file_hash) created.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
