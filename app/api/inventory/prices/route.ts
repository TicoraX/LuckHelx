import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listInventory } from '@/lib/rewards-store';
import { WEARS, isPriceable, getSkinPrices, setSkinPrice, isStale, parseSteamPrice } from '@/lib/skin-prices';

// Steam limita las consultas y no documenta cuánto. Se va de a una, espaciado, y con un
// techo por llamada: si faltan más, el botón se aprieta de nuevo. Preferible eso a una
// petición de dos minutos que el navegador corta por timeout.
const REQUEST_CAP = 12;
const SPACING_MS = 800;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSteamPrice(marketHashName: string): Promise<number | null> {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const data = (await res.json()) as { median_price?: string; lowest_price?: string };
  return parseSteamPrice(data.median_price) ?? parseSteamPrice(data.lowest_price);
}

export async function POST() {
  const db = getDb();
  const owned = listInventory(db).filter((item) => isPriceable(item.name));
  const cached = getSkinPrices(db, owned.map((item) => item.name));

  const pending = owned.filter((item) => isStale(cached.get(item.name)));

  let requests = 0;
  let updated = 0;

  for (const item of pending) {
    if (requests >= REQUEST_CAP) break;

    let usd: number | null = null;
    let wear: string | null = null;

    // El nombre del catálogo viene sin desgaste y Steam no cotiza así, ver lib/skin-prices.
    for (const candidate of WEARS) {
      if (requests >= REQUEST_CAP) break;
      if (requests > 0) await sleep(SPACING_MS);
      requests++;

      try {
        usd = await fetchSteamPrice(`${item.name} (${candidate})`);
      } catch {
        usd = null;
      }
      if (usd !== null) {
        wear = candidate;
        break;
      }
    }

    // Se guarda incluso cuando no cotizó: sin eso, cada visita reintentaría los mismos
    // nombres que Steam no tiene y el techo se gastaría siempre en lo mismo.
    setSkinPrice(db, item.name, usd, wear);
    updated++;
  }

  return NextResponse.json({
    updated,
    remaining: Math.max(0, pending.length - updated),
    requests,
  });
}
