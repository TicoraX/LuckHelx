import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '.local', 'data.db');
const presetPath = path.join(__dirname, 'cs2-cases-preset.json');

function seedCS2Rewards() {
  console.log(`Conectando a SQLite en: ${dbPath}`);
  if (!fs.existsSync(presetPath)) {
    console.error(`No existe el preset ${presetPath}. Ejecuta primero node csgo/fetch-cases.js`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  const db = new Database(dbPath);

  // Asegurar columnas de imagen y color si no existen
  try { db.exec("ALTER TABLE rewards ADD COLUMN image TEXT;"); } catch {}
  try { db.exec("ALTER TABLE rewards ADD COLUMN rarity_color TEXT;"); } catch {}

  const insertStmt = db.prepare(`
    INSERT INTO rewards (id, type, name, xp_cost, rarity, image, rarity_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  console.log(`Inyectando ${cases.length} cajas de CS2 y sus skins...`);

  let countCases = 0;
  let countSkins = 0;

  const transaction = db.transaction(() => {
    for (const c of cases) {
      const caseId = `csgo-${c.id}`;
      // Evitar duplicados si ya existe
      const exists = db.prepare('SELECT id FROM rewards WHERE id = ?').get(caseId);
      if (!exists) {
        insertStmt.run(caseId, 'chest', `Caja: ${c.name}`, 50, 'rare', c.image, '#ffd700');
        countCases++;
      }

      for (const item of c.items) {
        const itemId = `csgo-${item.id}`;
        const itemExists = db.prepare('SELECT id FROM rewards WHERE id = ?').get(itemId);
        if (!itemExists) {
          let rarityCategory = 'common';
          if (item.rarity.includes('Restricted')) rarityCategory = 'rare';
          if (item.rarity.includes('Classified') || item.rarity.includes('Covert') || item.rarity.includes('Extraordinary')) rarityCategory = 'epic';

          insertStmt.run(
            itemId,
            'chest_item',
            item.name,
            1,
            rarityCategory,
            item.image,
            item.rarityColor
          );
          countSkins++;
        }
      }
    }
  });

  transaction();

  console.log(`✅ Cemento completado! Se agregaron ${countCases} Cajas y ${countSkins} Skins reales de CS2.`);
}

seedCS2Rewards();
