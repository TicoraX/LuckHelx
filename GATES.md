# GATES.md: Acceptance Gates Ledger for LuckHelx

Registro verificable de compuertas de aceptación para cada entrega técnica.

## Compuertas

### G1: Zero TypeScript Compilation and Production Build Errors
- [x] G1: Compilación de producción en Next.js limpia con las 31 rutas estáticas y dinámicas generadas.
  - CHECK: `npm run build`
  - EXPECT: `Compiled successfully`

### G2: 100% Unit Test Suite Pass Rate
- [x] G2: Todas las pruebas unitarias y de integración pasan en los 30 archivos de prueba.
  - CHECK: `npm test`
  - EXPECT: `237 passed (237)`

### G3: NeMo Guardrails Interception and Bounds Defense
- [x] G3: Ataques de inyección de prompt e instrucciones maliciosas rechazados sin otorgar XP; valores de XP acotados a límites seguros.
  - CHECK: `npm test -- lib/guardrails.test.ts lib/deepseek.test.ts`
  - EXPECT: `12 passed (12)`

### G4: Gamification, Medals, Collections, ROI and Daily Free Spin
- [x] G4: Mecánicas de juego (Medallas de servicio CS2 en CAS, retención permanente en colecciones, valor esperado ROI y Daily Spin) verificadas con persistencia de estado.
  - CHECK: `npm test -- lib/prestige.test.ts lib/collections.test.ts lib/case-roi.test.ts lib/daily-spin.test.ts`
  - EXPECT: `6 passed (6)`

### G5: End-to-End Headless Browser Quality Assurance
- [x] G5: Ejecución automatizada con Playwright confirma 0 errores de consola, 0 fallos de red y respuestas HTTP 200 en todas las vistas principales.
  - CHECK: `node scripts/qa-runner.js`
  - EXPECT: `Prueba automatizada de QA finalizada`

### G6: Code Review and Zero Regressions
- [x] G6: 24 ítems de auditoría resueltos (idempotencia en trade-up/batch-open, sanitización CSV, fechas UTC, integridad de respaldos, control de volumen y accesibilidad).
  - CHECK: `npm test`
  - EXPECT: `30 passed (30)`

### G7: Master Audio Calibration and Web Audio Graph Isolation
- [x] G7: Grafo de síntesis Web Audio unifica nodos procedimentales mediante MasterGainNode y suspende rAF cuando la pista de audio de Valve está en reproducción.
  - CHECK: `npm test -- lib/settings-store.test.ts`
  - EXPECT: Rutas de calibración y volumen en verde.

### G8: Motion Polish and A11y Reduced-Motion Compliance
- [x] G8: Modal pop-in sin rebotes elásticos artificiales, respuesta :active scale(0.97) en botones e interrupción inmediata a 0ms en ruleta si el usuario prefiere movimiento reducido.
  - CHECK: `npm test -- lib/chest-reel.test.ts`
  - EXPECT: 100% de pruebas en verde y cero saltos de maquetación.

### G9: XP Transactional Integrity and Zero Race Conditions
- [x] G9: Mutación atómica de XP en SQLite con guarda de saldo no negativo, transacciones encapsuladas en aperturas en lote y trade-up, e índice único en quest_claims contra reclamos duplicados.
  - CHECK: `npm test -- lib/settings-store.test.ts lib/batch-open.test.ts lib/quests.test.ts lib/trade-up.test.ts`
  - EXPECT: `21 passed (21)`

### G10: HU-05 Case Battles 1v1 Transactional and Ledger Integrity
- [x] G10: Batallas de cajas contra bots simulados con débito atómico de XP, tiradas independientes, idempotencia vía operationId, acreditación de drops según resultado y ruleta dual sincronizada con audio procedimental.
  - CHECK: `npm test -- lib/case-battle.test.ts`
  - EXPECT: `8 passed (8)`

### G11: HU-06 CS2 Premier Rating, Habits and Inactivity Decay
- [x] G11: CS2 Premier Rating entre 1.000 y 35.000+ puntos en siete bandas oficiales, cálculo de consistencia en ventana móvil semanal, multiplicador de racha (hasta 2.0x), rank decay tras más de dos días de inactividad con piso en 1.000 puntos, fanfarria procedimental de ascenso y registro diario de snapshots en SQLite.
  - CHECK: `npm test -- lib/ranks.test.ts`
  - EXPECT: `19 passed (19)`

### G12: HU-08 CS2 Weapon Wear Ratings and EN/ES Localization (Sprint 3)
- [ ] G12: Asignación de desgaste con valores float (0.0000 - 0.9999) y condiciones en inglés (FN, MW, FT, WW, BS), tarjetas de inspección con barra de float y selector bilingüe reactivo ES/EN persistido en SQLite.
  - CHECK: `npm test -- lib/wear.test.ts lib/i18n.test.ts`
  - EXPECT: 100% pruebas en verde y cero errores de TypeScript.
