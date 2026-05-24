/**
 * Seed minimal : 1 organisation, 1 admin, 2 fournisseurs de démo.
 * Usage : npm run db:seed
 *
 * Idempotent : utilise INSERT … ON CONFLICT DO NOTHING.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { organizations, users, suppliers } from './schema';
import { eq } from 'drizzle-orm';

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

  // Organisation de démo
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Demo Organisation' })
    .onConflictDoNothing()
    .returning();

  // L'org peut déjà exister : on la charge si insert ignoré
  const orgId = org?.id ?? (
    await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.name, 'Demo Organisation'))
      .limit(1)
  )[0].id;

  // Admin user (idempotent sur l'email)
  const passwordHash = await bcrypt.hash('Admin1234!', 12);
  await db
    .insert(users)
    .values({
      email: 'admin@demo.com',
      passwordHash,
      role: 'admin',
      organizationId: orgId,
    })
    .onConflictDoNothing();

  // Fournisseurs de démo
  await db
    .insert(suppliers)
    .values([
      {
        organizationId: orgId,
        name: 'Acme Corp',
        siret: '12345678901234',
        vatNumber: 'FR12345678901',
        iban: 'FR7630006000011234567890189',
        address: '1 rue de la Paix, 75001 Paris',
      },
      {
        organizationId: orgId,
        name: 'Globex Solutions',
        siret: '98765432109876',
        vatNumber: 'FR98765432109',
        iban: 'FR7614508059203960044497741',
        address: '42 avenue des Champs, 69001 Lyon',
      },
    ])
    .onConflictDoNothing();

  console.log(`Seed OK — org #${orgId} | admin@demo.com / Admin1234!`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
