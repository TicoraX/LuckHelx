import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const REPORT_DIR = path.resolve('.gstack/qa-reports');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runQA() {
  console.log('🚀 Iniciando Suite de QA Automático para EStiri en:', BASE_URL);
  
  const consoleLogs = [];
  const consoleErrors = [];
  const networkFailures = [];

  const browser = await chromium.launch({ headless: true }).catch(async () => {
    return await chromium.launch({ channel: 'msedge', headless: true });
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    const loc = msg.location();
    if (loc?.url?.includes('favicon') || text.includes('favicon')) return;
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      if (loc?.url?.includes('favicon') || text.includes('favicon')) return;
      consoleErrors.push(`${text} (${loc?.url || 'unknown'})`);
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      if (res.url().includes('favicon')) return;
      networkFailures.push({ url: res.url(), status: res.status() });
    }
  });

  const pagesToTest = [
    { name: '01-home', url: '/' },
    { name: '02-rewards', url: '/rewards' },
    { name: '03-inventory', url: '/inventory' },
    { name: '04-ledger', url: '/ledger' }
  ];

  const pageResults = [];

  for (const target of pagesToTest) {
    console.log(`\n📌 Probando página: ${target.name} (${target.url})`);
    const fullUrl = `${BASE_URL}${target.url}`;
    const startNav = Date.now();
    
    try {
      const response = await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      const navTime = Date.now() - startNav;
      const status = response ? response.status() : 0;
      
      const ssPath = path.join(SCREENSHOT_DIR, `${target.name}.png`);
      await page.screenshot({ path: ssPath, fullPage: true });

      // Visual check: mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });
      const mobileSsPath = path.join(SCREENSHOT_DIR, `${target.name}-mobile.png`);
      await page.screenshot({ path: mobileSsPath, fullPage: true });
      await page.setViewportSize({ width: 1280, height: 720 });

      pageResults.push({
        name: target.name,
        url: target.url,
        status,
        navTimeMs: navTime,
        screenshot: `${target.name}.png`,
        mobileScreenshot: `${target.name}-mobile.png`
      });

      console.log(`  ✓ Status: ${status} | Carga: ${navTime}ms | Screenshot guardado`);
    } catch (err) {
      console.error(`  ❌ Error navegando a ${target.url}:`, err.message);
      pageResults.push({
        name: target.name,
        url: target.url,
        status: 'ERROR',
        error: err.message
      });
    }
  }

  // Interacción 1: Probar abrir Modal de Configuración en Home
  console.log('\n📌 Probando Modal de Ajustes...');
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const settingsBtn = page.locator('button.nav-link:has-text("Ajustes"), button:has-text("Ajustes"), button[title="Ajustes"]').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-settings-modal.png') });
      console.log('  ✓ Modal de Ajustes abierto y fotografiado');

      // Probar cerrar modal
      const closeBtn = page.locator('.modal-close, button:has-text("✕")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        console.log('  ✓ Modal de Ajustes cerrado correctamente');
      }
    } else {
      console.log('  ⚠️ Botón de Ajustes no encontrado por selector directo');
    }
  } catch (err) {
    console.error('  ❌ Error probando modal de ajustes:', err.message);
  }

  // Interacción 2: Probar página de Inventario y filtrado/acciones
  console.log('\n📌 Probando Inventario y Venta de ítems...');
  try {
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-inventory-loaded.png') });
    
    // Verificar si hay cards de inventario o estado vacío
    const emptyState = page.locator('text=Tu inventario está vacío');
    if (await emptyState.isVisible()) {
      console.log('  ℹ️ Inventario actual está vacío (Estado válido)');
    } else {
      console.log('  ✓ Inventario contiene ítems listados');
    }
  } catch (err) {
    console.error('  ❌ Error en verificación de inventario:', err.message);
  }

  // Interacción 3: Probar modal de Case Battles en Rewards
  console.log('\n📌 Probando Modal de Case Battles en Rewards...');
  try {
    await page.goto(`${BASE_URL}/rewards`, { waitUntil: 'networkidle' });
    const chestsTab = page.locator('button.tab-btn:has-text("Cofres")').first();
    if (await chestsTab.isVisible()) {
      await chestsTab.click();
      await page.waitForTimeout(400);
    }
    const battleBtn = page.locator('button:has-text("Case Battle 1v1"), button:has-text("1v1")').first();
    if (await battleBtn.isVisible()) {
      await battleBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-case-battle-modal.png') });
      console.log('  ✓ Modal de Case Battle abierto y fotografiado');

      const closeBtn = page.locator('button[aria-label="Cerrar modal"], button:has-text("Cancelar"), button:has-text("✕")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        console.log('  ✓ Modal de Case Battle cerrado correctamente');
      }
    } else {
      console.log('  ⚠️ Botón de Case Battle no visible de inmediato en rewards');
    }
  } catch (err) {
    console.error('  ❌ Error probando modal de case battle:', err.message);
  }

  // Verificar APIs directamente
  console.log('\n📌 Verificando endpoints API...');
  const apiEndpoints = [
    '/api/state',
    '/api/rewards',
    '/api/inventory',
    '/api/ledger',
    '/api/settings',
    '/api/case-battle'
  ];

  const apiResults = [];
  for (const ep of apiEndpoints) {
    try {
      const res = await page.request.get(`${BASE_URL}${ep}`);
      apiResults.push({ endpoint: ep, status: res.status(), ok: res.ok() });
      console.log(`  ✓ ${ep} -> Status ${res.status()}`);
    } catch (err) {
      apiResults.push({ endpoint: ep, status: 'ERROR', error: err.message });
      console.error(`  ❌ ${ep} -> Error:`, err.message);
    }
  }

  await browser.close();

  // Guardar resultados de ejecución
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages: pageResults,
    apis: apiResults,
    consoleLogsCount: consoleLogs.length,
    consoleErrors: [...new Set(consoleErrors)],
    networkFailures
  };

  fs.writeFileSync(path.join(REPORT_DIR, 'raw-qa-summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n✅ Prueba automatizada de QA finalizada. Resumen raw escrito en raw-qa-summary.json');

  const hasPageErrors = pageResults.some((p) => p.status !== 200);
  const hasApiErrors = apiResults.some((a) => a.status !== 200);
  const hasConsoleErrors = consoleErrors.length > 0;
  const hasNetworkFailures = networkFailures.length > 0;

  if (hasPageErrors || hasApiErrors || hasConsoleErrors || hasNetworkFailures) {
    console.error('❌ QA Runner detectó fallos durante la ejecución.');
    process.exitCode = 1;
  }
}

runQA().catch((err) => {
  console.error('Fatal error en runner de QA:', err);
  process.exit(1);
});
