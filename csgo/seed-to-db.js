import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '.local', 'data.db');
const presetPath = path.join(__dirname, 'cs2-cases-preset.json');

function rarityCategory(rarityName, isRare) {
  if (isRare) return 'legendary';
  if (rarityName.includes('Restricted')) return 'rare';
  if (rarityName.includes('Classified') || rarityName.includes('Covert') || rarityName.includes('Extraordinary')) return 'epic';
  return 'common';
}

function seedCS2Rewards() {
  console.log(`Conectando a SQLite en: ${dbPath}`);
  if (!fs.existsSync(presetPath)) {
    console.error(`No existe el preset ${presetPath}. Ejecuta primero node csgo/build-cases.js`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const insertReward = db.prepare(`
    INSERT INTO rewards (id, type, name, xp_cost, rarity, image, rarity_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO chest_contents (chest_id, chest_item_id) VALUES (?, ?)
  `);
  const rewardExists = db.prepare('SELECT id FROM rewards WHERE id = ?');

  console.log(`Sembrando ${cases.length} cajas de CS2 y sus skins...`);

  let countCases = 0;
  let countSkins = 0;
  let countLinks = 0;

  const transaction = db.transaction(() => {
    for (const c of cases) {
      const caseId = `csgo-${c.id}`;
      if (!rewardExists.get(caseId)) {
        insertReward.run(caseId, 'chest', `Caja: ${c.name}`, c.xpCost, 'rare', c.image, '#ffd700');
        countCases++;
      }

      for (const item of c.items) {
        const itemId = `csgo-${item.id}`;
        if (!rewardExists.get(itemId)) {
          insertReward.run(
            itemId,
            'chest_item',
            item.name,
            1,
            rarityCategory(item.rarity, item.isRare),
            item.image,
            item.rarityColor
          );
          countSkins++;
        }
        const linkResult = insertLink.run(caseId, itemId);
        if (linkResult.changes > 0) countLinks++;
      }
    }
  });

  transaction();

  console.log(`✅ Listo: ${countCases} cajas, ${countSkins} skins, ${countLinks} vínculos caja→skin.`);
}

seedCS2Rewards();
