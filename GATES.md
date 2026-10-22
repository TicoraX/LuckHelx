# GATES.md — Hoja de Ruta de Aceptación y Certificación: LuckHelx v0.3.0

> **Proyecto**: LuckHelx (`a:\Proyectos\EStiri`)  
> **Versión**: v0.3.0  
> **Disciplina**: `/unlazy` (Compuertas verificables con comandos y expectativas ejecutables)  
> **Invariantes**: Aritmética XP en centésimas enteras (1 XP = 100 unidades), Paridad 1:1 CS2 ($1 USD = 1.00 XP), Inmutabilidad de ledgers, Concurrencia atómica SQLite, Bypass 0ms a11y en motion, Toolchain Rust (`oxlint`, `biome`).

---

## Compuertas de Aceptación (Acceptance Gates)

### [x] GATE-0: Poda Quirúrgica de Deuda Técnica & Alineación Económica
- **Objetivo**: Purgar módulos huérfanos (`lib/prestige.ts`, `lib/case-roi.ts`, analytics muertos, iconos sin uso, backup preview), corregir bug de `free_key` en Daily Spin (249 unidades en vez de 8,000) y configurar `biome.json` ignores para escaneos sub-30ms. Balance neto estimado: -532 líneas.
- **CHECK**:
  ```text
  node -e "const fs = require('fs'); if (fs.existsSync('lib/prestige.ts') || fs.existsSync('lib/case-roi.ts')) process.exit(1); console.log('PRUNED_CLEAN');" && npm test
  ```
- **EXPECT**:
  ```text
  PRUNED_CLEAN
  ```

---

### [x] GATE-1: Pragmas de Alta Concurrencia en SQLite & Erradicación de Escaneos O(N*M)
- **Objetivo**: Configurar pragmas SQLite (`WAL`, `busy_timeout = 5000`, `synchronous = NORMAL`, `cache_size = -64000`, `temp_store = MEMORY`), crear índices B-Tree en `redemptions(won_item_id)` e `item_sales(item_id)` para erradicar el Full Table Scan en inventario, y optimizar `sellOneItem` sin doble escaneo.
- **CHECK**:
  ```text
  node -e "const { getDb } = require('./lib/db.ts'); const db = getDb(); const plan = db.prepare('EXPLAIN QUERY PLAN SELECT COUNT(*) FROM item_sales WHERE item_id = ?').all('test'); const usesIndex = plan.some(p => p.detail.includes('idx_item_sales_item_id')); if (!usesIndex) process.exit(1); console.log('INDEX_CONFIRMED');"
  ```
- **EXPECT**:
  ```text
  INDEX_CONFIRMED
  ```

---

### [x] GATE-2: Motor de Tasación Granular por Ítem (Anti-Empates en Case Battles)
- **Objetivo**: Implementar `getDeterministicSkinPrice(name, rarity)` en `lib/skin-prices.ts` utilizando fórmula multi-factor ($\text{BaseTier} \times \text{WeaponFactor} \times \text{NameEntropyVariation}$) y sembrar snapshot de precios en `initSchema`. Erradicar empates por rareza idéntica en `lib/case-battle.ts` y añadir Tie-Breaker Provably Fair (HMAC-SHA256).
- **CHECK**:
  ```text
  npx vitest run lib/case-battle.test.ts lib/skin-prices.test.ts
  ```
- **EXPECT**:
  ```text
  ✓ lib/case-battle.test.ts
  ✓ lib/skin-prices.test.ts
  ```

---

### [x] GATE-3: Módulo UPGRADE Core & Modelo Provably Fair Criptográfico
- **Objetivo**: Implementar `lib/upgrade.ts` con tipado de dominio estricto, fórmula de odds con cuota transparente del 5% ($P = \min(0.95, \max(0.0001, \frac{V_{in}}{V_{out} \times (1 + e)}))$), cálculo determinista HMAC-SHA256 libre de sesgo de módulo, transacción atómica SQLite con quema en `item_sales` e historial inmutable en tabla `upgrades`.
- **CHECK**:
  ```text
  npx vitest run lib/upgrade.test.ts
  ```
- **EXPECT**:
  ```text
  ✓ lib/upgrade.test.ts
  ```

---

### [x] GATE-4: Motor Sonoro Web Audio CS2 (Pegada, Sub-Graves & Inmersión)
- **Objetivo**: Refactorizar `lib/sound.ts` con `DynamicsCompressorNode`, `BiquadFilterNode` para sub-bass drops en rarezas altas, whoosh filtrado, ticks mecánicos con micro-variación de pitch, fanfarrias y sonidos dedicados para UPGRADE (`playUpgradeSpinTick`, `playUpgradeWhoosh`, `playUpgradeWin`, `playUpgradeLoss`).
- **CHECK**:
  ```text
  npx vitest run lib/sound.test.ts
  ```
- **EXPECT**:
  ```text
  ✓ lib/sound.test.ts
  ```
- **EVIDENCIA**: Certificado con 3/3 tests pasando al 100% en Node/Vitest con fallback seguro en entornos sin audio y compresión dinámica configurada.

---

### [x] GATE-5: Integración Global del Premier Rating & Rango CS2
- **Objetivo**: Permear el Premier Rating (1,000 a 35,000+ pts) en toda la experiencia: marcos dinámicos de avatar según color de tier (`PREMIER_TIERS`), indicador en barra de navegación y dashboard, perks sutiles de racha / XP, y medallas de vitrina.
- **CHECK**:
  ```text
  npx vitest run lib/ranks.test.ts
  ```
- **EXPECT**:
  ```text
  ✓ lib/ranks.test.ts
  ```
- **EVIDENCIA**: Certificado con 20/20 tests pasando al 100%. `PremierAvatar.tsx` implementado con halo reactivo y medalla de vitrina para Tier 3+, perks de escalado XP (0% a 12%) e integrado en Header, Navbar y MobileNav.

---

### [x] GATE-6: Componente Ruleta Circular SVG de UPGRADE & Ruta `/upgrade`
- **Objetivo**: Construir componente `UpgradeWheel.tsx` en SVG/Canvas con `describeArc`, aguja indicadora superior, rotación elástica en GPU (`transform: rotate`, `cubic-bezier(0.15, 0.9, 0.2, 1)`), bypass instantáneo a 0ms en `prefers-reduced-motion`, selector de skins y página `/upgrade` integrada.
- **CHECK**:
  ```text
  npm run build
  ```
- **EXPECT**:
  ```text
  Route (app)
  /upgrade
  ```
- **EVIDENCIA**: Build de Next.js compilado limpiamente con 32 rutas (incluyendo `○ /upgrade` en 5.46 kB y `ƒ /api/upgrade`), renderizado SVG con sector angular matemático, aguja superior, audio de tensión y bypass a 0ms comprobado.

---

### [x] GATE-7: Certificación Final de Build & Toolchain en Rust
- **Objetivo**: Validación holística de todo el workspace con `oxlint`, `biome check`, suite completa de pruebas Vitest y compilación de Next.js libre de warnings.
- **CHECK**:
  ```text
  npx oxlint app components lib && npm test && npm run build
  ```
- **EXPECT**:
  ```text
  Found 0 warnings and 0 errors
  Tests  251 passed (251)
  ✓ Compiled successfully
  ```
- **EVIDENCIA**: `oxlint` completó en 15ms con 0 errores y 0 warnings en 121 archivos. Vitest sellado con 30 suites y 251 tests pasando al 100%. Next.js build genera 32 rutas limpias.

