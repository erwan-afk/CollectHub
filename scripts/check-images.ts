import { neon } from '@neondatabase/serverless';
const sql = neon(process.env['DATABASE_URL']!);
(async () => {
  const rows = await sql`SELECT name, image FROM items ORDER BY id`;
  for (const r of rows) console.log(`${r.name} → ${r.image}`);
})();
