import { describe, it, expect } from 'vitest';
import { createTestDb } from './db';
import { getSkinPrices, setSkinPrice, isStale, parseSteamPrice, isPriceable, priceQueryNames, wearOf, resolveSkinPrice } from './skin-prices';

describe('resolveSkinPrice', () => {
  it('takes the first wear that quotes, and reports which one it was', async () => {
    const r = await resolveSkinPrice('AK-47 | Redline', 5, async (q) =>
      q.endsWith('(Minimal Wear)') ? 42 : null
    );
    expect(r).toMatchObject({ usd: 42, wear: 'Minimal Wear', confirmed: true, requests: 2 });
  });

  it('confirms a real "no quota" once every candidate answered', async () => {
    const r = await resolveSkinPrice('AK-47 | Redline', 9, async () => null);
    expect(r).toMatchObject({ usd: null, confirmed: true, requests: 5 });
  });

  // Lo que motivó todo esto: una caída de Steam se guardaba como "esta skin no cotiza" y
  // la dejaba sin precio los 7 días enteros del stale.
  it('does not confirm anything when the request fails', async () => {
    const r = await resolveSkinPrice('AK-47 | Redline', 5, async () => {
      throw new Error('ECONNRESET');
    });
    expect(r).toMatchObject({ usd: null, confirmed: false, requests: 1 });
  });

  it('does not confirm anything when the budget cuts the candidates short', async () => {
    const r = await resolveSkinPrice('AK-47 | Redline', 2, async () => null);
    expect(r).toMatchObject({ usd: null, confirmed: false, requests: 2 });
  });

  it('spends a single request on a vanilla knife', async () => {
    const r = await resolveSkinPrice('★ Bayonet', 5, async () => 380.01);
    expect(r).toMatchObject({ usd: 380.01, wear: null, confirmed: true, requests: 1 });
  });
});

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
