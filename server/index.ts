import express from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Collections ──

app.get('/api/collections', async (_req, res) => {
  try {
    const rows = await sql`
      SELECT c.*,
        COALESCE(json_agg(i.* ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM collections c
      LEFT JOIN items i ON i.collection_id = c.id
      GROUP BY c.id
      ORDER BY c.id
    `;
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/collections/:id', async (req, res) => {
  try {
    const [row] = await sql`
      SELECT c.*,
        COALESCE(json_agg(i.* ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM collections c
      LEFT JOIN items i ON i.collection_id = c.id
      WHERE c.id = ${req.params.id}
      GROUP BY c.id
    `;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/collections', async (req, res) => {
  try {
    const [row] = await sql`
      INSERT INTO collections (title) VALUES (${req.body.title})
      RETURNING *
    `;
    row.items = [];
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/collections/:id', async (req, res) => {
  try {
    const [row] = await sql`
      UPDATE collections SET title = ${req.body.title} WHERE id = ${req.params.id}
      RETURNING *
    `;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/collections/:id', async (req, res) => {
  try {
    await sql`DELETE FROM collections WHERE id = ${req.params.id}`;
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Items ──

app.post('/api/collections/:cid/items', async (req, res) => {
  try {
    const { name, description, image, rarity, price } = req.body;
    const [row] = await sql`
      INSERT INTO items (collection_id, name, description, image, rarity, price)
      VALUES (${req.params.cid}, ${name}, ${description || ''}, ${image || ''}, ${rarity}, ${price || 0})
      RETURNING *
    `;
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/collections/:cid/items/:iid', async (req, res) => {
  try {
    const { name, description, image, rarity, price } = req.body;
    const [row] = await sql`
      UPDATE items
      SET name = ${name}, description = ${description || ''}, image = ${image || ''},
          rarity = ${rarity}, price = ${price || 0}
      WHERE id = ${req.params.iid} AND collection_id = ${req.params.cid}
      RETURNING *
    `;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/collections/:cid/items/:iid', async (req, res) => {
  try {
    await sql`DELETE FROM items WHERE id = ${req.params.iid} AND collection_id = ${req.params.cid}`;
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`🚀 API sur http://localhost:${PORT}`));
