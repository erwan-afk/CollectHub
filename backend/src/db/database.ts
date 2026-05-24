import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env';
import * as schema from './schema';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Instance Drizzle partagée — utiliser `db` pour le nouveau code,
// `pool` pour les requêtes existantes en attente de migration.
export const db = drizzle(pool, { schema });
