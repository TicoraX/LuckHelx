# GATES.md — Acceptance Gates Ledger for Sistema de Recompensas

This ledger records verifiable acceptance gates for all deliverable components.

## Gates

### G1: Zero TypeScript Compilation and Production Build Errors
- [x] G1: Full Next.js production build succeeds with all 31 static and dynamic routes compiled.
  - CHECK: `npm run build`
  - EXPECT: `Compiled successfully`

### G2: 100% Unit Test Suite Pass Rate
- [x] G2: All unit and integration test suites pass across 30 test files.
  - CHECK: `npm test`
  - EXPECT: `224 passed (224)`

### G3: NeMo Guardrails Interception & Bounds Defense
- [x] G3: Prompt injection attacks and malicious overrides are rejected without XP award and XP output is bounded (1-200).
  - CHECK: `npm test -- lib/guardrails.test.ts lib/deepseek.test.ts`
  - EXPECT: `12 passed (12)`

### G4: Gamification, Medals, Collections, ROI and Daily Free Spin
- [x] G4: Core game mechanics (CS2 Service Medals CAS, Collections permanent retention, ROI 100.0% expected value, Daily Spin) pass with verified state persistence.
  - CHECK: `npm test -- lib/prestige.test.ts lib/collections.test.ts lib/case-roi.test.ts lib/daily-spin.test.ts`
  - EXPECT: `6 passed (6)`

### G5: End-to-End Headless Browser Quality Assurance
- [x] G5: Playwright automated runner confirms 0 console errors, 0 network failures, and valid HTTP 200 responses across all views, failing fast on errors.
  - CHECK: `node scripts/qa-runner.js`
  - EXPECT: `Prueba automatizada de QA finalizada`

### G6: Code Review & Zero Regressions
- [x] G6: 24 CodeRabbit audit items resolved (Idempotency in trade-up/batch-open, CSV sanitization, UTC dates, Backup integrity, Sound gain, UI accessibility).
  - CHECK: `npm test`
  - EXPECT: `30 passed (30)`

### G7: Master Audio Calibration & Web Audio Graph Isolation
- [x] G7: Web Audio synthesis graph unifies procedural sound nodes through MasterGainNode, links HTMLAudioElement sample volume, and suspends rAF when Valve audio track is playing.
  - CHECK: `npm test -- lib/settings-store.test.ts`
  - EXPECT: All sound calibration and volume scale paths pass cleanly.

### G8: Motion Polish & A11y Reduced-Motion Compliance
- [x] G8: Modal pop-in complies with Emil Kowalski standard (scale 0.95 -> 1 with cubic-bezier, no 1.03 bounce), :active scale(0.97) feedback active on all interactive buttons, and prefers-reduced-motion triggers immediate 0ms resolution in ChestReel.
  - CHECK: `npm test -- lib/chest-reel.test.ts`
  - EXPECT: 100% tests pass and zero layout thrashing.

### G9: XP Transactional Integrity & Zero Race Conditions
- [x] G9: XP balance mutation is atomic in SQLite with non-negative guard, batch open and trade-up checks are fully encapsulated in transactions, and quest_claims enforces unique index constraint against duplicate claims.
  - CHECK: `npm test -- lib/settings-store.test.ts lib/batch-open.test.ts lib/quests.test.ts lib/trade-up.test.ts`
  - EXPECT: `21 passed (21)` across all 4 hardening suites.

### G10: HU-05 Case Battles 1v1 Transactional & Ledger Integrity
- [x] G10: Case battles against simulated bots enforce atomic XP debiting, dual independent drop rolls, idempotency via operationId, correct winner-takes-all crediting (+2 skins on win, 0 skins on loss, 1 skin on tie), and synchronous dual reel animation with Web Audio victory/defeat synthesis.
  - CHECK: `npm test -- lib/case-battle.test.ts`
  - EXPECT: `8 passed (8)`

### G11: HU-06 CS2 Premier Rating, Habits & Inactivity Decay
- [x] G11: CS2 Premier Rating spans 1,000 to 35,000+ across all 7 official color bands, calculates habit consistency from 7-day rolling window, active streak multiplier (up to 2.0x), enforces rank decay (> 2 days inactivity at 250 pts/day) with calibrated 1,000 pts floor, provides procedural rank promotion fanfare via MasterGainNode, and renders accessible badges with WCAG 2.2 AA contrast.
  - CHECK: `npm test -- lib/ranks.test.ts`
  - EXPECT: `16 passed (16)`

