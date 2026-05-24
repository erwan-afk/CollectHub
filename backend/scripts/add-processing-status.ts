/**
 * One-off: adds PROCESSING to the invoice_status enum.
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction (Drizzle wraps migrations),
 * so this script runs it directly outside any transaction block.
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
    // Must run outside a transaction block
    await client.query(`ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'PROCESSING'`);
    console.log("Added 'PROCESSING' to invoice_status enum.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
