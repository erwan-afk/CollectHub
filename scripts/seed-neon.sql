-- ============================================================
-- Script de seed pour Neon (PostgreSQL)
-- Garage de voitures de collection
-- ============================================================

-- Nettoyage
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS collections CASCADE;

-- Tables
CREATE TABLE collections (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE items (
  id            SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  image         VARCHAR(512) DEFAULT '',
  rarity        VARCHAR(50) NOT NULL CHECK (rarity IN ('Common','Uncommon','Rare','Legendary')),
  price         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_items_collection ON items(collection_id);
CREATE INDEX idx_items_rarity ON items(rarity);

-- ============================================================
-- Donnees
-- ============================================================

-- Collection 1 : F1
INSERT INTO collections (title) VALUES ('F1 - Monoplaces de legende');
WITH c AS (SELECT id FROM collections WHERE title = 'F1 - Monoplaces de legende')
INSERT INTO items (collection_id, name, description, rarity, price, image) VALUES
  ((SELECT id FROM c), 'Ferrari F2004',      'Schumacher, 15 victoires en 2004. La plus dominante de l''histoire.', 'Legendary', 580,  'img/image1.png'),
  ((SELECT id FROM c), 'McLaren MP4/4',      'Senna & Prost, 15 courses sur 16 remportees en 1988.',               'Legendary', 450,  'img/image2.png'),
  ((SELECT id FROM c), 'Williams FW14B',     'Mansell, suspension active. Championne 1992.',                        'Rare',      220,  'img/image1.png'),
  ((SELECT id FROM c), 'Lotus 79',           'Mario Andretti, championne 1978. Revolution de l''effet de sol.',      'Rare',      190,  'img/image2.png'),
  ((SELECT id FROM c), 'Red Bull RB19',      'Verstappen, 21 courses sur 22 gagnees en 2023.',                     'Uncommon',  175,  'img/image1.png'),
  ((SELECT id FROM c), 'Mercedes W11',       'Hamilton, record de 7 titres. Black Arrow 2020.',                     'Uncommon',  160,  'img/image2.png'),
  ((SELECT id FROM c), 'Alpine A523',        'Ocon & Gasly, podium Monaco 2023. Rose & bleue.',                     'Common',     65,  'img/image1.png');

-- Collection 2 : GT3
INSERT INTO collections (title) VALUES ('GT3 - Circuit');
WITH c AS (SELECT id FROM collections WHERE title = 'GT3 - Circuit')
INSERT INTO items (collection_id, name, description, rarity, price, image) VALUES
  ((SELECT id FROM c), 'Porsche 911 GT3 R',        'Flat-6 4.0L, la reine des 24H. Son des enfers.',                 'Legendary', 340, 'img/image2.png'),
  ((SELECT id FROM c), 'Ferrari 296 GT3',          'V6 biturbo, championne 2024. Rouge corsa.',                       'Rare',      310, 'img/image1.png'),
  ((SELECT id FROM c), 'Mercedes-AMG GT3',         'V8 6.2L, multiples victoires aux 24H du Nurburgring.',           'Rare',      210, 'img/image2.png'),
  ((SELECT id FROM c), 'BMW M4 GT3',               'L6 3.0L, retour gagnant en 2022. Calandre iconique.',            'Uncommon',  155, 'img/image1.png'),
  ((SELECT id FROM c), 'Aston Martin Vantage GT3', 'V8 4.0L, livree vert britannique. Elegance british.',            'Uncommon',  170, 'img/image2.png'),
  ((SELECT id FROM c), 'McLaren 720S GT3',         'V8 4.0L, papillon. Aerodynamique extreme.',                      'Common',    115, 'img/image1.png');

-- Collection 3 : LMP1
INSERT INTO collections (title) VALUES ('LMP1 - Endurance');
WITH c AS (SELECT id FROM collections WHERE title = 'LMP1 - Endurance')
INSERT INTO items (collection_id, name, description, rarity, price, image) VALUES
  ((SELECT id FROM c), 'Porsche 919 Hybrid',      'V4 turbo + hybrid, triple vainqueur Le Mans 2015-2017.',          'Legendary', 370, 'img/image2.png'),
  ((SELECT id FROM c), 'Toyota TS050 Hybrid',     'V6 biturbo + hybrid, vainqueur 2018-2020. La revanche.',          'Legendary', 320, 'img/image1.png'),
  ((SELECT id FROM c), 'Audi R18 e-tron quattro', 'V6 TDI + hybrid, domination 2012-2014. Diesel de legende.',       'Rare',      230, 'img/image2.png'),
  ((SELECT id FROM c), 'Peugeot 908 HDi FAP',     'V12 HDi, victoire 2009. Le lion rugissant.',                      'Rare',      180, 'img/image1.png'),
  ((SELECT id FROM c), 'Rebellion R13',           'V8 Gibson, derniere privee en LMP1. L''outsider heroique.',        'Uncommon',  130, 'img/image2.png');

-- Collection 4 : LMP2
INSERT INTO collections (title) VALUES ('LMP2 - Endurance');
WITH c AS (SELECT id FROM collections WHERE title = 'LMP2 - Endurance')
INSERT INTO items (collection_id, name, description, rarity, price, image) VALUES
  ((SELECT id FROM c), 'Oreca 07',              'V8 Gibson, la plus victorieuse en LMP2. Championne 2017-2024.',     'Rare',      160, 'img/image1.png'),
  ((SELECT id FROM c), 'Ligier JS P217',        'V8 Gibson, podium Le Mans 2018. Bleu France.',                      'Uncommon',  125, 'img/image2.png'),
  ((SELECT id FROM c), 'Dallara P217',          'V8 Gibson, championne ELMS 2020. Chassis italien.',                 'Uncommon',  120, 'img/image1.png'),
  ((SELECT id FROM c), 'United Autosports #22', 'Oreca 07, victoire Le Mans 2020. L''equipe de Zak Brown.',           'Common',     95, 'img/image2.png');

-- Collection 5 : WRC
INSERT INTO collections (title) VALUES ('Rallye - WRC');
WITH c AS (SELECT id FROM collections WHERE title = 'Rallye - WRC')
INSERT INTO items (collection_id, name, description, rarity, price, image) VALUES
  ((SELECT id FROM c), 'Lancia Delta HF Integrale', '6 titres WRC 1987-1992. La reine du Groupe A.',                'Legendary', 480, 'img/image1.png'),
  ((SELECT id FROM c), 'Subaru Impreza 555',        'McRae & Burns, championne 1995. Bleue et or iconique.',         'Legendary', 390, 'img/image2.png'),
  ((SELECT id FROM c), 'Toyota GR Yaris Rally1',    '3 cylindres turbo + hybrid, championne 2022-2024.',            'Rare',      185, 'img/image1.png'),
  ((SELECT id FROM c), 'Ford Puma Rally1',          'Hybride, M-Sport. La nouvelle ere du WRC.',                     'Uncommon',  145, 'img/image2.png'),
  ((SELECT id FROM c), 'Citroen C3 WRC',            'Ogier, 2 titres 2018-2019. La derniere danse francaise.',       'Common',     85, 'img/image1.png');

-- Verification
SELECT c.title, COUNT(i.id) AS items, SUM(i.price) AS valeur_totale
FROM collections c
LEFT JOIN items i ON i.collection_id = c.id
GROUP BY c.id, c.title
ORDER BY c.id;
