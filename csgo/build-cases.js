import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cratesPath = path.join(__dirname, 'public', 'api', 'en', 'crates.json');
const pricesPath = path.join(__dirname, 'case-prices.json');
const outputPath = path.join(__dirname, 'cs2-cases-preset.json');

const PRICE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUEST_DELAY_MS = 300;
const FALLBACK_XP_COST = 50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadPriceCache() {
  if (!fs.existsSync(pricesPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(pricesPath, 'utf-8'));
  } catch {
    return {};
  }
}

function usdToXp(usd, fallback = FALLBACK_XP_COST) {
  if (usd === null || usd === undefined || !Number.isFinite(usd) || usd < 0) {
    return fallback;
  }
  return Math.max(1, Math.round(usd));
}

async function fetchSteamPrice(marketHashName) {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.success || !data.lowest_price) return null;
  const parsed = Number(String(data.lowest_price).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolvePrice(crate, cache) {
  const cached = cache[crate.market_hash_name];
  const isFresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < PRICE_CACHE_MAX_AGE_MS;
  if (isFresh) return cached.usd;

  try {
    const usd = await fetchSteamPrice(crate.market_hash_name);
    cache[crate.market_hash_name] = { usd, fetchedAt: new Date().toISOString() };
    return usd;
  } catch (err) {
    console.warn(`  precio falló para "${crate.name}": ${err.message}`);
    cache[crate.market_hash_name] = { usd: null, fetchedAt: new Date().toISOString() };
    return null;
  }
}

function mapItem(item, isRare) {
  return {
    id: item.id,
    name: item.name,
    rarity: item.rarity?.name || 'Común',
    rarityColor: item.rarity?.color || '#b0c3d9',
    image: item.image,
    isRare,
  };
}

async function main() {
  console.log('Leyendo catálogo local desde public/api/en/crates.json...');
  const crates = JSON.parse(fs.readFileSync(cratesPath, 'utf-8'));
  const validCrates = crates.filter((c) => c.contains && c.contains.length > 0);
  console.log(`${validCrates.length} cajas válidas con contenido.`);

  const priceCache = loadPriceCache();
  const results = [];
  const fallbackNames = [];

  for (const [index, crate] of validCrates.entries()) {
    process.stdout.write(`\r[${index + 1}/${validCrates.length}] ${crate.name}...`.padEnd(80));
    const usd = await resolvePrice(crate, priceCache);
    if (usd === null) fallbackNames.push(crate.name);

    results.push({
      id: crate.id,
      name: crate.name,
      description: crate.description || `Caja oficial de CS2: ${crate.name}`,
      image: crate.image,
      xpCost: usdToXp(usd),
      items: [
        ...crate.contains.map((item) => mapItem(item, false)),
        ...(crate.contains_rare || []).map((item) => mapItem(item, true)),
      ],
    });

    await sleep(REQUEST_DELAY_MS);
  }
  console.log('');

  fs.writeFileSync(pricesPath, JSON.stringify(priceCache, null, 2), 'utf-8');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`✅ ${results.length} cajas escritas en ${outputPath}`);
  if (fallbackNames.length > 0) {
    console.log(`⚠️  ${fallbackNames.length} cajas usaron el costo de respaldo (${FALLBACK_XP_COST} XP) por falta de precio:`);
    fallbackNames.forEach((name) => console.log(`   - ${name}`));
  }
}

main();
