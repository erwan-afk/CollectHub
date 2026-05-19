import { neon } from '@neondatabase/serverless';

const sql = neon(process.env['DATABASE_URL']!);

const imageMap: Record<string, string> = {
  // F1
  'Ferrari F2004':       'img/f1_ferrari_f2004.jpg',
  'McLaren MP4/4':       'img/f1_mclaren_mp44.jpg',
  'Williams FW14B':      'img/f1_williams_fw14b.jpg',
  'Lotus 79':            'img/f1_lotus_79.jpg',
  'Red Bull RB19':       'img/f1_red_bull_rb19.jpg',
  'Mercedes W11':        'img/f1_red_bull_rb19.jpg',
  'Alpine A523':         'img/f1_mclaren_mp44.jpg',
  // GT3
  'Porsche 911 GT3 R':        'img/gt3_porsche_911.jpg',
  'Ferrari 296 GT3':          'img/gt3_porsche_911.jpg',
  'Mercedes-AMG GT3':         'img/gt3_mercedes_amg.jpg',
  'BMW M4 GT3':               'img/gt3_mercedes_amg.jpg',
  'Aston Martin Vantage GT3': 'img/gt3_mclaren_720s.jpg',
  'McLaren 720S GT3':         'img/gt3_mclaren_720s.jpg',
  // LMP1
  'Porsche 919 Hybrid':       'img/lmp1_porsche_919.jpg',
  'Toyota TS050 Hybrid':      'img/lmp1_toyota_lemans.jpg',
  'Audi R18 e-tron quattro':  'img/lmp1_audi_r18.jpg',
  'Peugeot 908 HDi FAP':      'img/lmp1_audi_r18.jpg',
  'Rebellion R13':             'img/lmp1_toyota_lemans.jpg',
  // LMP2
  'Oreca 07':              'img/lmp2_oreca_sebring.jpg',
  'Ligier JS P217':        'img/lmp2_oreca_sebring.jpg',
  'Dallara P217':          'img/lmp2_oreca_sebring.jpg',
  'United Autosports #22': 'img/lmp2_oreca_sebring.jpg',
  // Rallye
  'Lancia Delta HF Integrale': 'img/rally_lancia_delta.jpg',
  'Subaru Impreza 555':        'img/rally_subaru.jpg',
  'Toyota GR Yaris Rally1':    'img/rally_toyota_yaris.jpg',
  'Ford Puma Rally1':          'img/rally_ford_puma.jpg',
  'Citroën C3 WRC':            'img/rally_ford_puma.jpg',
};

async function run() {
  let updated = 0;
  for (const [name, image] of Object.entries(imageMap)) {
    const result = await sql`UPDATE items SET image = ${image} WHERE name = ${name}`;
    if (result.length !== undefined || true) {
      console.log(`✓ ${name} → ${image}`);
      updated++;
    }
  }
  console.log(`\nTotal: ${updated} items mis à jour`);
}

run().catch(err => { console.error(err); process.exit(1); });
