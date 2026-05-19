CREATE TABLE IF NOT EXISTS collections (
  id   SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL DEFAULT 'My Collection'
);

CREATE TABLE IF NOT EXISTS items (
  id            SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  image         VARCHAR(512) DEFAULT '',
  rarity        VARCHAR(50) NOT NULL DEFAULT 'Legendary' CHECK (rarity IN ('Legendary', 'Rare', 'Uncommon', 'Common')),
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
