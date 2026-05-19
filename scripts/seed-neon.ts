import { neon } from '@neondatabase/serverless';

// Config ── remplace par ta connection string Neon
const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

// ── Types ──
type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

interface ItemSeed {
  name: string;
  description: string;
  rarity: Rarity;
  price: number;
  image: string;
}

interface CollectionSeed {
  title: string;
  items: ItemSeed[];
}

// ── Données ──
const data: CollectionSeed[] = [
  {
    title: 'F1 - Monoplaces de légende',
    items: [
      { name: 'Ferrari F2004',      description: "Schumacher, 15 victoires en 2004. La plus dominante de l'histoire.", rarity: 'Legendary', price: 580,  image: 'img/image1.png' },
      { name: 'McLaren MP4/4',      description: 'Senna & Prost, 15 courses sur 16 remportées en 1988.',               rarity: 'Legendary', price: 450,  image: 'img/image2.png' },
      { name: 'Williams FW14B',     description: 'Mansell, suspension active. Championne 1992.',                        rarity: 'Rare',      price: 220,  image: 'img/image1.png' },
      { name: 'Lotus 79',           description: "Mario Andretti, championne 1978. Révolution de l'effet de sol.",      rarity: 'Rare',      price: 190,  image: 'img/image2.png' },
      { name: 'Red Bull RB19',      description: 'Verstappen, 21 courses sur 22 gagnées en 2023.',                     rarity: 'Uncommon',  price: 175,  image: 'img/image1.png' },
      { name: 'Mercedes W11',       description: 'Hamilton, record de 7 titres. Black Arrow 2020.',                     rarity: 'Uncommon',  price: 160,  image: 'img/image2.png' },
      { name: 'Alpine A523',        description: 'Ocon & Gasly, podium Monaco 2023. Rose & bleue.',                     rarity: 'Common',    price: 65,   image: 'img/image1.png' },
    ],
  },
  {
    title: 'GT3 - Circuit',
    items: [
      { name: 'Porsche 911 GT3 R',        description: 'Flat-6 4.0L, la reine des 24H. Son des enfers.',                 rarity: 'Legendary', price: 340, image: 'img/image2.png' },
      { name: 'Ferrari 296 GT3',          description: 'V6 biturbo, championne 2024. Rouge corsa.',                       rarity: 'Rare',      price: 310, image: 'img/image1.png' },
      { name: 'Mercedes-AMG GT3',         description: 'V8 6.2L, multiples victoires aux 24H du Nürburgring.',           rarity: 'Rare',      price: 210, image: 'img/image2.png' },
      { name: 'BMW M4 GT3',               description: 'L6 3.0L, retour gagnant en 2022. Calandre iconique.',            rarity: 'Uncommon',  price: 155, image: 'img/image1.png' },
      { name: 'Aston Martin Vantage GT3', description: 'V8 4.0L, livrée vert britannique. Élégance british.',            rarity: 'Uncommon',  price: 170, image: 'img/image2.png' },
      { name: 'McLaren 720S GT3',         description: 'V8 4.0L, papillon. Aérodynamique extrême.',                      rarity: 'Common',    price: 115, image: 'img/image1.png' },
    ],
  },
  {
    title: 'LMP1 - Endurance',
    items: [
      { name: 'Porsche 919 Hybrid',      description: 'V4 turbo + hybrid, triple vainqueur Le Mans 2015-2017.',          rarity: 'Legendary', price: 370, image: 'img/image2.png' },
      { name: 'Toyota TS050 Hybrid',     description: 'V6 biturbo + hybrid, vainqueur 2018-2020. La revanche.',          rarity: 'Legendary', price: 320, image: 'img/image1.png' },
      { name: 'Audi R18 e-tron quattro', description: 'V6 TDI + hybrid, domination 2012-2014. Diesel de légende.',       rarity: 'Rare',      price: 230, image: 'img/image2.png' },
      { name: 'Peugeot 908 HDi FAP',     description: 'V12 HDi, victoire 2009. Le lion rugissant.',                      rarity: 'Rare',      price: 180, image: 'img/image1.png' },
      { name: 'Rebellion R13',           description: "V8 Gibson, dernière privée en LMP1. L'outsider héroïque.",        rarity: 'Uncommon',  price: 130, image: 'img/image2.png' },
    ],
  },
  {
    title: 'LMP2 - Endurance',
    items: [
      { name: 'Oreca 07',              description: 'V8 Gibson, la plus victorieuse en LMP2. Championne 2017-2024.',     rarity: 'Rare',      price: 160, image: 'img/image1.png' },
      { name: 'Ligier JS P217',        description: 'V8 Gibson, podium Le Mans 2018. Bleu France.',                      rarity: 'Uncommon',  price: 125, image: 'img/image2.png' },
      { name: 'Dallara P217',          description: 'V8 Gibson, championne ELMS 2020. Châssis italien.',                 rarity: 'Uncommon',  price: 120, image: 'img/image1.png' },
      { name: 'United Autosports #22', description: "Oreca 07, victoire Le Mans 2020. L'équipe de Zak Brown.",           rarity: 'Common',    price: 95,  image: 'img/image2.png' },
    ],
  },
  {
    title: 'Rallye - WRC',
    items: [
      { name: 'Lancia Delta HF Integrale', description: '6 titres WRC 1987-1992. La reine du Groupe A.',                rarity: 'Legendary', price: 480, image: 'img/image1.png' },
      { name: 'Subaru Impreza 555',        description: 'McRae & Burns, championne 1995. Bleue et or iconique.',         rarity: 'Legendary', price: 390, image: 'img/image2.png' },
      { name: 'Toyota GR Yaris Rally1',    description: '3 cylindres turbo + hybrid, championne 2022-2024.',            rarity: 'Rare',      price: 185, image: 'img/image1.png' },
      { name: 'Ford Puma Rally1',          description: 'Hybride, M-Sport. La nouvelle ère du WRC.',                     rarity: 'Uncommon',  price: 145, image: 'img/image2.png' },
      { name: 'Citroën C3 WRC',            description: 'Ogier, 2 titres 2018-2019. La dernière danse française.',       rarity: 'Common',    price: 85,  image: 'img/image1.png' },
    ],
  },
];

// ── Seed ──
async function seed() {
  console.log('🚀 Connexion à Neon...\n');

  // 1. Nettoyage
  await sql`DROP TABLE IF EXISTS items CASCADE`;
  await sql`DROP TABLE IF EXISTS collections CASCADE`;

  // 2. Création tables
  await sql`
    CREATE TABLE collections (
      id         SERIAL PRIMARY KEY,
      title      VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE items (
      id            SERIAL PRIMARY KEY,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      name          VARCHAR(255) NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      image         VARCHAR(512) DEFAULT '',
      rarity        VARCHAR(50) NOT NULL CHECK (rarity IN ('Common','Uncommon','Rare','Legendary')),
      price         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
      created_at    TIMESTAMPTZ DEFAULT now()
    )
  `;

  // 3. Insertion
  let totalItems = 0;

  for (const col of data) {
    const [inserted] = await sql`
      INSERT INTO collections (title) VALUES (${col.title})
      RETURNING id
    `;
    const collectionId = inserted.id as number;

    for (const item of col.items) {
      await sql`
        INSERT INTO items (collection_id, name, description, rarity, price, image)
        VALUES (${collectionId}, ${item.name}, ${item.description}, ${item.rarity}, ${item.price}, ${item.image})
      `;
      totalItems++;
    }

    console.log(`   ✅ ${col.title} — ${col.items.length} voitures`);
  }

  // 4. Résumé
  console.log(`\n📊 Total : ${data.length} collections, ${totalItems} voitures\n`);

  const stats = await sql`
    SELECT c.title, COUNT(i.id)::int AS items, COALESCE(SUM(i.price), 0)::float AS total
    FROM collections c
    LEFT JOIN items i ON i.collection_id = c.id
    GROUP BY c.id, c.title
    ORDER BY c.id
  `;

  console.table(stats);
  console.log('✨ Seed terminé !');
}

seed().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
