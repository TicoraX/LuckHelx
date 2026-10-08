import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '.local', 'data.db');

/**
 * Precios de referencia de mercado para skins de alta frecuencia en CS2 (Field-Tested / Vanilla).
 * Estos valores representan una línea base realista para que el inventario y las aperturas
 * cuenten con cotización inmediata desde el minuto cero sin depender de consultas 1 a 1.
 */
export const POPULAR_SKIN_PRICES = {
  // AK-47
  'AK-47 | Redline': { usd: 14.5, wear: 'Field-Tested' },
  'AK-47 | Slate': { usd: 2.8, wear: 'Field-Tested' },
  'AK-47 | Ice Coaled': { usd: 7.2, wear: 'Field-Tested' },
  'AK-47 | Asiimov': { usd: 34.0, wear: 'Field-Tested' },
  'AK-47 | Vulcan': { usd: 340.0, wear: 'Field-Tested' },
  'AK-47 | Case Hardened': { usd: 245.0, wear: 'Field-Tested' },
  'AK-47 | Frontside Misty': { usd: 16.5, wear: 'Field-Tested' },
  'AK-47 | Neon Rider': { usd: 48.0, wear: 'Field-Tested' },
  'AK-47 | Legion of Anubis': { usd: 12.0, wear: 'Field-Tested' },
  'AK-47 | Phantom Disruptor': { usd: 6.8, wear: 'Field-Tested' },
  'AK-47 | Safari Mesh': { usd: 0.12, wear: 'Field-Tested' },
  'AK-47 | Uncharted': { usd: 0.45, wear: 'Field-Tested' },
  'AK-47 | Elite Build': { usd: 1.8, wear: 'Field-Tested' },
  'AK-47 | Blue Laminate': { usd: 11.5, wear: 'Field-Tested' },
  'AK-47 | Red Laminate': { usd: 38.0, wear: 'Field-Tested' },
  'AK-47 | Point Disarray': { usd: 18.0, wear: 'Field-Tested' },
  'AK-47 | The Empress': { usd: 32.0, wear: 'Field-Tested' },
  'AK-47 | Nightwish': { usd: 9.5, wear: 'Field-Tested' },
  'AK-47 | Head Shot': { usd: 13.5, wear: 'Field-Tested' },
  'AK-47 | Inheritance': { usd: 65.0, wear: 'Field-Tested' },

  // AWP
  'AWP | Atheris': { usd: 3.2, wear: 'Field-Tested' },
  'AWP | Duality': { usd: 3.5, wear: 'Field-Tested' },
  'AWP | Asiimov': { usd: 95.0, wear: 'Field-Tested' },
  'AWP | Neo-Noir': { usd: 28.0, wear: 'Field-Tested' },
  'AWP | Hyper Beast': { usd: 26.5, wear: 'Field-Tested' },
  'AWP | Mortis': { usd: 2.2, wear: 'Field-Tested' },
  'AWP | Worm God': { usd: 1.5, wear: 'Field-Tested' },
  'AWP | PAW': { usd: 1.8, wear: 'Field-Tested' },
  'AWP | Wildfire': { usd: 55.0, wear: 'Field-Tested' },
  'AWP | Chromatic Aberration': { usd: 8.5, wear: 'Field-Tested' },
  'AWP | Electric Hive': { usd: 62.0, wear: 'Field-Tested' },
  'AWP | BOOM': { usd: 88.0, wear: 'Field-Tested' },
  'AWP | Lightning Strike': { usd: 420.0, wear: 'Factory New' },
  'AWP | Graphite': { usd: 195.0, wear: 'Factory New' },
  'AWP | Containment Breach': { usd: 68.0, wear: 'Field-Tested' },
  'AWP | Fever Dream': { usd: 8.0, wear: 'Field-Tested' },

  // M4A4
  'M4A4 | The Emperor': { usd: 16.0, wear: 'Field-Tested' },
  'M4A4 | Spider Lily': { usd: 3.5, wear: 'Field-Tested' },
  'M4A4 | Desolate Space': { usd: 6.5, wear: 'Field-Tested' },
  'M4A4 | Neo-Noir': { usd: 14.0, wear: 'Field-Tested' },
  'M4A4 | In Living Color': { usd: 7.5, wear: 'Field-Tested' },
  'M4A4 | Tooth Fairy': { usd: 3.0, wear: 'Field-Tested' },
  'M4A4 | Magnesium': { usd: 0.35, wear: 'Field-Tested' },
  'M4A4 | Evil Daimyo': { usd: 3.2, wear: 'Field-Tested' },
  'M4A4 | Griffin': { usd: 2.5, wear: 'Field-Tested' },
  'M4A4 | Dragon King': { usd: 10.5, wear: 'Field-Tested' },
  'M4A4 | Hellfire': { usd: 52.0, wear: 'Field-Tested' },
  'M4A4 | Buzz Kill': { usd: 11.0, wear: 'Field-Tested' },
  'M4A4 | Temukau': { usd: 15.0, wear: 'Field-Tested' },
  'M4A4 | Cyber Security': { usd: 18.0, wear: 'Field-Tested' },
  'M4A4 | Etch Lord': { usd: 1.8, wear: 'Field-Tested' },

  // M4A1-S
  'M4A1-S | Printstream': { usd: 145.0, wear: 'Field-Tested' },
  'M4A1-S | Hyper Beast': { usd: 18.0, wear: 'Field-Tested' },
  'M4A1-S | Decimator': { usd: 14.5, wear: 'Field-Tested' },
  'M4A1-S | Cyrex': { usd: 22.0, wear: 'Field-Tested' },
  'M4A1-S | Player Two': { usd: 21.0, wear: 'Field-Tested' },
  'M4A1-S | Nightmare': { usd: 16.0, wear: 'Field-Tested' },
  'M4A1-S | Leaded Glass': { usd: 7.0, wear: 'Field-Tested' },
  'M4A1-S | Basilisk': { usd: 8.5, wear: 'Field-Tested' },
  'M4A1-S | Flashback': { usd: 1.5, wear: 'Field-Tested' },
  'M4A1-S | Emphorosaur-S': { usd: 0.85, wear: 'Field-Tested' },
  'M4A1-S | Night Terror': { usd: 0.95, wear: 'Field-Tested' },
  'M4A1-S | Black Lotus': { usd: 14.0, wear: 'Field-Tested' },

  // Desert Eagle
  'Desert Eagle | Printstream': { usd: 42.0, wear: 'Field-Tested' },
  'Desert Eagle | Code Red': { usd: 24.0, wear: 'Field-Tested' },
  'Desert Eagle | Mecha Industries': { usd: 6.8, wear: 'Field-Tested' },
  'Desert Eagle | Conspiracy': { usd: 7.5, wear: 'Field-Tested' },
  'Desert Eagle | Kumicho Dragon': { usd: 19.0, wear: 'Field-Tested' },
  'Desert Eagle | Light Rail': { usd: 2.2, wear: 'Field-Tested' },
  'Desert Eagle | Trigger Discipline': { usd: 0.85, wear: 'Field-Tested' },
  'Desert Eagle | Blue Ply': { usd: 0.35, wear: 'Field-Tested' },
  'Desert Eagle | Corinthian': { usd: 0.45, wear: 'Field-Tested' },
  'Desert Eagle | Ocean Drive': { usd: 16.5, wear: 'Field-Tested' },

  // USP-S
  'USP-S | Printstream': { usd: 45.0, wear: 'Field-Tested' },
  'USP-S | Kill Confirmed': { usd: 140.0, wear: 'Field-Tested' },
  'USP-S | Cortex': { usd: 4.8, wear: 'Field-Tested' },
  'USP-S | Neo-Noir': { usd: 16.0, wear: 'Field-Tested' },
  'USP-S | Cyrex': { usd: 2.5, wear: 'Field-Tested' },
  'USP-S | Flashback': { usd: 0.75, wear: 'Field-Tested' },
  'USP-S | Ticket to Hell': { usd: 0.65, wear: 'Field-Tested' },
  'USP-S | Black Lotus': { usd: 2.2, wear: 'Field-Tested' },
  'USP-S | Jawbreaker': { usd: 11.5, wear: 'Field-Tested' },
  'USP-S | The Traitor': { usd: 11.0, wear: 'Field-Tested' },

  // Glock-18
  'Glock-18 | Water Elemental': { usd: 6.5, wear: 'Field-Tested' },
  'Glock-18 | Vogue': { usd: 4.5, wear: 'Field-Tested' },
  'Glock-18 | Bullet Queen': { usd: 9.0, wear: 'Field-Tested' },
  'Glock-18 | Moonrise': { usd: 1.2, wear: 'Field-Tested' },
  'Glock-18 | High Beam': { usd: 0.95, wear: 'Factory New' },
  'Glock-18 | Clear Polymer': { usd: 0.45, wear: 'Field-Tested' },
  'Glock-18 | Off World': { usd: 0.25, wear: 'Field-Tested' },
  'Glock-18 | Snack Attack': { usd: 3.5, wear: 'Field-Tested' },
  'Glock-18 | Block-18': { usd: 1.1, wear: 'Field-Tested' },

  // Cuchillos Vanilla y populares (★)
  '★ Bayonet': { usd: 380.0, wear: null },
  '★ Karambit': { usd: 1100.0, wear: null },
  '★ M9 Bayonet': { usd: 980.0, wear: null },
  '★ Butterfly Knife': { usd: 1750.0, wear: null },
  '★ Skeleton Knife': { usd: 450.0, wear: null },
  '★ Talon Knife': { usd: 520.0, wear: null },
  '★ Flip Knife': { usd: 260.0, wear: null },
  '★ Huntsman Knife': { usd: 175.0, wear: null },
  '★ Bowie Knife': { usd: 135.0, wear: null },
  '★ Falchion Knife': { usd: 145.0, wear: null },
  '★ Gut Knife': { usd: 120.0, wear: null },
  '★ Shadow Daggers': { usd: 110.0, wear: null },
  '★ Ursus Knife': { usd: 195.0, wear: null },
  '★ Stiletto Knife': { usd: 360.0, wear: null },
  '★ Nomad Knife': { usd: 320.0, wear: null },
  '★ Survival Knife': { usd: 140.0, wear: null },
  '★ Paracord Knife': { usd: 155.0, wear: null },
  '★ Classic Knife': { usd: 240.0, wear: null },
  '★ Navaja Knife': { usd: 95.0, wear: null },
  '★ Kukri Knife': { usd: 310.0, wear: null },
};

export function seedPopularSkinPrices(db) {
  const upsert = db.prepare(`
    INSERT INTO skin_prices (name, usd, wear, fetched_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      usd = excluded.usd,
      wear = excluded.wear,
      fetched_at = excluded.fetched_at
    WHERE skin_prices.usd IS NULL OR skin_prices.usd = 0
  `);

  let count = 0;
  const tx = db.transaction(() => {
    for (const [name, data] of Object.entries(POPULAR_SKIN_PRICES)) {
      const res = upsert.run(name, data.usd, data.wear);
      if (res.changes > 0) count++;
    }
  });

  tx();
  return count;
}

if (process.argv[1] && process.argv[1].endsWith('seed-skin-prices.js')) {
  console.log(`Sembrando precios de referencia en: ${dbPath}`);
  const db = new Database(dbPath);
  const seeded = seedPopularSkinPrices(db);
  console.log(`✅ Listo: ${seeded} skins con precios de referencia sembradas en SQLite.`);
}
