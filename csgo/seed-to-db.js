import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

import { initSchema } from '../lib/db.ts';

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
  initSchema(db);

  // UPSERT, no "insertar si no existe". Sembrar solo insertaba, así que regenerar el
  // preset no cambiaba una sola fila: las cajas se quedaban con el costo que tuvieran el
  // día que se sembraron, y arreglar el mapeo de rareza en el código no corregía a los
  // cuchillos ya guardados como epic. Volver a correr esto ahora sí reconcilia la base.
  // `created_at` no se toca: es la fecha de salida real de la caja y ordena el catálogo.
  const upsertItem = db.prepare(`
    INSERT INTO rewards (id, type, name, xp_cost, rarity, image, rarity_color)
    -- 100 unidades = 1 XP. Es un relleno para satisfacer el CHECK \`xp_cost > 0\`: los
    -- objetos de cofre no se canjean sueltos, salen de abrir la caja. El valor coincide
    -- con lo que deja la migracion a unidades para que las bases no diverjan.
    VALUES (?, 'chest_item', ?, 100, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, rarity = excluded.rarity,
      image = excluded.image, rarity_color = excluded.rarity_color
  `);
  // Real release date sorts meaningfully (2013 vs 2026); las cajas sin fecha caen a
  // la época Unix para que queden siempre al final en "más nuevas" en vez de colarse
  // primeras con la hora de inserción (ninguna caja real de CS2 es anterior a 2013).
  const upsertChest = db.prepare(`
    INSERT INTO rewards (id, type, name, xp_cost, rarity, image, rarity_color, created_at)
    VALUES (?, 'chest', ?, ?, 'rare', ?, '#ffd700', COALESCE(?, '1970-01-01 00:00:00'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, xp_cost = excluded.xp_cost, image = excluded.image,
      -- Las cajas sembradas antes de que el preset trajera fecha quedaron con la hora de
      -- inserción y se colaban primeras en "más nuevas". Se reconcilian con la fecha real
      -- cuando el preset la tiene; sin fecha, se respeta lo que ya está guardado.
      created_at = COALESCE(?, created_at)
  `);
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO chest_contents (chest_id, chest_item_id) VALUES (?, ?)
  `);
  const rewardExists = db.prepare('SELECT id FROM rewards WHERE id = ?');

  console.log(`Sembrando ${cases.length} cajas de CS2 y sus skins...`);

  let newCases = 0;
  let newSkins = 0;
  let countLinks = 0;

  const transaction = db.transaction(() => {
    for (const c of cases) {
      const caseId = `csgo-${c.id}`;
      if (!rewardExists.get(caseId)) newCases++;
      // La fecha va dos veces: al COALESCE del INSERT y al del UPDATE.
      const releasedAt = c.firstSaleDate ? `${c.firstSaleDate} 00:00:00` : null;
      upsertChest.run(caseId, `Caja: ${c.name}`, c.xpCost, c.image, releasedAt, releasedAt);

      for (const item of c.items) {
        const itemId = `csgo-${item.id}`;
        if (!rewardExists.get(itemId)) newSkins++;
        upsertItem.run(
          itemId,
          item.name,
          rarityCategory(item.rarity, item.isRare),
          item.image,
          item.rarityColor
        );

        const linkResult = insertLink.run(caseId, itemId);
        if (linkResult.changes > 0) countLinks++;
      }
    }
  });

  transaction();

  console.log(
    `✅ Listo: ${newCases} cajas nuevas, ${newSkins} skins nuevas, ${countLinks} vínculos caja→skin nuevos.`
  );
  console.log(`   Las ${cases.length} cajas del preset y sus objetos quedaron reconciliados con el preset actual.`);
}

seedCS2Rewards();
