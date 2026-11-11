import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { initSchema } from '../lib/db';

describe('CS2 Cases Preset and Seed Dates (#17)', () => {
  const presetPath = path.join(__dirname, 'cs2-cases-preset.json');

  it('contains zero unpadded or malformed firstSaleDate in cs2-cases-preset.json', () => {
    const raw = fs.readFileSync(presetPath, 'utf-8');
    const cases = JSON.parse(raw);

    const malformed = cases.filter(
      (c: { id: string; firstSaleDate?: string | null }) =>
        c.firstSaleDate && !/^\d{4}-\d{2}-\d{2}$/.test(c.firstSaleDate)
    );

    expect(malformed).toHaveLength(0);
  });

  it('stores all chest created_at in canonical YYYY-MM-DD HH:mm:ss format', () => {
    const db = new Database(':memory:');
    initSchema(db);

    const raw = fs.readFileSync(presetPath, 'utf-8');
    const cases = JSON.parse(raw);

    const upsertChest = db.prepare(`
      INSERT INTO rewards (id, type, name, xp_cost, rarity, image, rarity_color, created_at, requires_key)
      VALUES (?, 'chest', ?, ?, 'rare', ?, '#ffd700', COALESCE(?, '1970-01-01 00:00:00'), 1)
      ON CONFLICT(id) DO UPDATE SET
        created_at = COALESCE(?, '1970-01-01 00:00:00')
    `);

    db.transaction(() => {
      for (const c of cases.slice(0, 50)) {
        const releasedAt = c.firstSaleDate ? `${c.firstSaleDate} 00:00:00` : null;
        upsertChest.run(`csgo-${c.id}`, c.name, 100, c.image, releasedAt, releasedAt);
      }
    })();

    const invalid = db
      .prepare(
        "SELECT id, created_at FROM rewards WHERE type = 'chest' AND created_at NOT LIKE '____-__-__ __:__:__'"
      )
      .all();

    expect(invalid).toHaveLength(0);
  });
});
