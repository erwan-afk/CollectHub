/**
 * Script d'exécution des migrations Drizzle.
 * Usage : npm run db:migrate
 *
 * Applique les fichiers SQL de src/db/migrations/ dans l'ordre,
 * en tenant la table __drizzle_migrations comme journal.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const db = drizzle(pool);

  console.log('Running migrations…');
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, 'migrations'),
  });
  console.log('Migrations complete.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
