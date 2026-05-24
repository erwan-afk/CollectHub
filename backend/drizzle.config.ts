import * as dotenv from 'dotenv';
import * as path from 'path';
// Le .env est à la racine du monorepo, pas dans backend/
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Pour `db:generate`, DATABASE_URL peut être absent (pas de connexion réelle).
    // Pour `db:migrate` / `db:push`, il doit pointer vers la vraie DB.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost/placeholder',
  },
  verbose: true,
  strict: true,
});
