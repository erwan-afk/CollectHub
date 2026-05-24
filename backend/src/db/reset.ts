/**
 * Supprime tout le schéma public et le recrée vide.
 * DANGER : perte totale des données. Dev uniquement.
 * Usage : npm run db:reset
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Pool } from 'pg';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('db:reset is forbidden in production');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Dropping public schema…');
  // DROP CASCADE supprime tables, séquences, vues, types, indexes d'un coup.
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
  console.log('Schema reset. Run `npm run db:migrate` to reapply migrations.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
