import { pool } from './database';
import { Collection, CollectionRow } from '../types/collection';
import { CollectionItem, CollectionItemRow } from '../types/collection-item';

// ─── Collections ────────────────────────────────────────────────────────────

export async function getAllCollections(limit = 50, offset = 0): Promise<Collection[]> {
  const { rows } = await pool.query<CollectionRow>(`
    SELECT c.id, c.title,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', i.id,
            'name', i.name,
            'description', i.description,
            'image', i.image,
            'rarity', i.rarity,
            'price', i.price
          ) ORDER BY i.position, i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS items
    FROM collections c
    LEFT JOIN items i ON i.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.id
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return rows.map(mapCollection);
}

export async function getCollectionsCount(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::int AS count FROM collections');
  return Number(rows[0].count);
}

export async function getCollectionById(id: number): Promise<Collection | null> {
  const { rows } = await pool.query<CollectionRow>(`
    SELECT c.id, c.title,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', i.id,
            'name', i.name,
            'description', i.description,
            'image', i.image,
            'rarity', i.rarity,
            'price', i.price
          ) ORDER BY i.position, i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS items
    FROM collections c
    LEFT JOIN items i ON i.collection_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);

  if (rows.length === 0) return null;
  return mapCollection(rows[0]);
}

export async function createCollection(title: string): Promise<Collection> {
  const { rows } = await pool.query<CollectionRow>(
    `INSERT INTO collections (title) VALUES ($1) RETURNING id, title, '[]'::json AS items`,
    [title],
  );
  return mapCollection(rows[0]);
}

export async function updateCollection(id: number, title: string): Promise<Collection | null> {
  const { rows } = await pool.query<{ id: number; title: string }>(
    `UPDATE collections SET title = $1 WHERE id = $2 RETURNING id, title`,
    [title, id],
  );
  if (rows.length === 0) return null;
  return getCollectionById(id);
}

export async function deleteCollection(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM collections WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function createItem(
  collectionId: number,
  item: Omit<CollectionItem, 'id'>,
): Promise<CollectionItem | null> {
  const collectionExists = await pool.query(
    `SELECT id FROM collections WHERE id = $1`,
    [collectionId],
  );
  if (collectionExists.rows.length === 0) return null;

  const { rows } = await pool.query<CollectionItemRow>(
    `INSERT INTO items (collection_id, name, description, image, rarity, price)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, description, image, rarity, price::float`,
    [collectionId, item.name, item.description, item.image, item.rarity, item.price],
  );
  return mapItem(rows[0]);
}

export async function updateItem(
  collectionId: number,
  itemId: number,
  item: Omit<CollectionItem, 'id'>,
): Promise<CollectionItem | null> {
  const { rows } = await pool.query<CollectionItemRow>(
    `UPDATE items
     SET name = $1, description = $2, image = $3, rarity = $4, price = $5
     WHERE id = $6 AND collection_id = $7
     RETURNING id, name, description, image, rarity, price::float`,
    [item.name, item.description, item.image, item.rarity, item.price, itemId, collectionId],
  );
  if (rows.length === 0) return null;
  return mapItem(rows[0]);
}

export async function deleteItem(collectionId: number, itemId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM items WHERE id = $1 AND collection_id = $2`,
    [itemId, collectionId],
  );
  return (rowCount ?? 0) > 0;
}

export async function reorderItems(
  collectionId: number,
  itemIds: number[],
): Promise<Collection | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < itemIds.length; i++) {
      await client.query(
        `UPDATE items SET position = $1 WHERE id = $2 AND collection_id = $3`,
        [i, itemIds[i], collectionId],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getCollectionById(collectionId);
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    title: row.title,
    items: (row.items as CollectionItemRow[]).map(mapItem),
  };
}

function mapItem(row: CollectionItemRow): CollectionItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image: row.image,
    rarity: row.rarity,
    price: Number(row.price),
  };
}
