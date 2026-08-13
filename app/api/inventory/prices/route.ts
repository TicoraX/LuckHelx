import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listInventory } from '@/lib/rewards-store';
import { resolveSkinPrice, isPriceable, getSkinPrices, setSkinPrice, isStale, parseSteamPrice } from '@/lib/skin-prices';

// Steam limita las consultas y no documenta cuánto. Se va de a una, espaciado, y con un
// techo por llamada: si faltan más, el botón se aprieta de nuevo. Preferible eso a una
// petición de dos minutos que el navegador corta por timeout.
const REQUEST_CAP = 12;
const SPACING_MS = 800;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSteamPrice(marketHashName: string): Promise<number | null> {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  // Un 429 o un 503 no significan "no cotiza": son rate limit y caída. Se propagan para
  // que la skin quede obsoleta y se reintente, en vez de guardarse como sin precio.
  if (!res.ok) throw new Error(`steam respondio ${res.status}`);

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

    // Las skins de arma se consultan con desgaste y los cuchillos vanilla sin él, ver
    // lib/skin-prices. El espaciado queda acá porque es política de esta ruta.
    const result = await resolveSkinPrice(item.name, REQUEST_CAP - requests, async (queryName) => {
      if (requests > 0) await sleep(SPACING_MS);
      requests++;
      return fetchSteamPrice(queryName);
    });

    // Sin conclusión (falló la red, o el techo cortó los candidatos a medias) el precio
    // guardado no se toca: queda obsoleto y el próximo apretón lo reintenta.
    if (!result.confirmed) continue;

    // Un "no cotiza" confirmado sí se guarda: sin eso, cada visita reintentaría los
    // mismos nombres que Steam no tiene y el techo se gastaría siempre en lo mismo.
    setSkinPrice(db, item.name, result.usd, result.wear);
    updated++;
  }

  return NextResponse.json({
    updated,
    remaining: Math.max(0, pending.length - updated),
    requests,
  });
}
