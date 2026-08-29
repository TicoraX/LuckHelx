# GATES.md — Acceptance Gates Ledger for Sistema de Recompensas

This ledger records verifiable acceptance gates for all deliverable components.

## Gates

### G1: Zero TypeScript Compilation and Production Build Errors
- [x] G1: Full Next.js production build succeeds with all 28 static and dynamic routes compiled.
  - CHECK: `npm run build`
  - EXPECT: `Compiled successfully`

### G2: 100% Unit Test Suite Pass Rate
- [x] G2: All unit and integration test suites pass across 27 test files.
  - CHECK: `npm test`
  - EXPECT: `189 passed (189)`

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
  - EXPECT: `27 passed (27)`
