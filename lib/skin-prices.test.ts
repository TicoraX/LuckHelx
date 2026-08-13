import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getSkinPrices, setSkinPrice, isStale, parseSteamPrice, isPriceable, priceQueryNames, wearOf } from './skin-prices';

describe('parseSteamPrice', () => {
  it('reads the money string Steam returns', () => {
    expect(parseSteamPrice('$16.07')).toBe(16.07);
    expect(parseSteamPrice('$1,234.50')).toBe(1234.5);
  });

  it('returns null for anything that is not a price', () => {
    expect(parseSteamPrice(undefined)).toBeNull();
    expect(parseSteamPrice('')).toBeNull();
    expect(parseSteamPrice(16.07)).toBeNull();
  });
});

describe('price lookup shape', () => {
  // Verificado contra Steam el 2026-08-13: las skins de arma solo cotizan con desgaste en
  // el nombre, y los cuchillos vanilla solo cotizan sin el. Es al reves entre si.
  it('appends every wear for a weapon skin', () => {
    const names = priceQueryNames('MP7 | Skulls');
    expect(names[0]).toBe('MP7 | Skulls (Field-Tested)');
    expect(names).toHaveLength(5);
  });

  it('asks for a vanilla knife by its bare name', () => {
    expect(priceQueryNames('★ Bayonet')).toEqual(['★ Bayonet']);
  });

  it('treats both shapes as priceable', () => {
    expect(isPriceable('★ Bayonet')).toBe(true);
    expect(isPriceable('MP7 | Skulls')).toBe(true);
  });

  it('reports the wear that produced the price, or none for a bare name', () => {
    expect(wearOf('MP7 | Skulls (Well-Worn)', 'MP7 | Skulls')).toBe('Well-Worn');
    expect(wearOf('★ Bayonet', '★ Bayonet')).toBeNull();
  });
});

describe('skin price cache', () => {
  it('round-trips a price with the wear it came from', () => {
    const db = createTestDb();
    setSkinPrice(db, 'MP7 | Skulls', 16.07, 'Field-Tested');

    const row = getSkinPrices(db, ['MP7 | Skulls']).get('MP7 | Skulls');
    expect(row?.usd).toBe(16.07);
    expect(row?.wear).toBe('Field-Tested');
  });

  // Sin esto, cada refresco reintentaria los nombres que Steam no cotiza y el techo por
  // llamada se gastaria siempre en los mismos.
  it('remembers that a name has no price at all', () => {
    const db = createTestDb();
    setSkinPrice(db, 'Nada | Inexistente', null, null);

    const row = getSkinPrices(db, ['Nada | Inexistente']).get('Nada | Inexistente');
    expect(row).toBeDefined();
    expect(row?.usd).toBeNull();
    expect(isStale(row)).toBe(false);
  });

  it('treats a never-fetched name as stale', () => {
    expect(isStale(undefined)).toBe(true);
  });

  it('treats a price older than a week as stale', () => {
    const db = createTestDb();
    db.prepare(
      "INSERT INTO skin_prices (name, usd, wear, fetched_at) VALUES ('vieja', 1, 'Field-Tested', datetime('now', '-8 days'))"
    ).run();

    expect(isStale(getSkinPrices(db, ['vieja']).get('vieja'))).toBe(true);
  });

  it('asks for nothing when the inventory is empty', () => {
    expect(getSkinPrices(createTestDb(), []).size).toBe(0);
  });
});
