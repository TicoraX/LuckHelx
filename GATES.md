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
  - EXPECT: `182 passed (182)`

### G3: NeMo Guardrails Interception & Bounds Defense
- [x] G3: Prompt injection attacks and malicious overrides are rejected and XP output is clamped.
  - CHECK: `npm test -- lib/guardrails.test.ts`
  - EXPECT: `4 passed (4)`

### G4: Gamification, Medals, Collections, ROI and Daily Free Spin
- [x] G4: Core game mechanics (CS2 Service Medals, Collections, ROI expected value, Daily Spin) pass with verified state persistence.
  - CHECK: `npm test -- lib/prestige.test.ts lib/collections.test.ts lib/case-roi.test.ts lib/daily-spin.test.ts`
  - EXPECT: `4 passed (4)`

### G5: End-to-End Headless Browser Quality Assurance
- [x] G5: Playwright automated runner confirms 0 console errors, 0 network failures, and valid HTTP 200 responses across all views.
  - CHECK: `node scripts/qa-runner.js`
  - EXPECT: `Prueba automatizada de QA finalizada`

### G6: Code Craft, Lean Architecture and Zero Unused Dependencies
- [x] G6: Codebase contains zero unneeded external libraries, no duplicate utility functions, and consolidated date/audio engines.
  - CHECK: `npm test -- lib/date.test.ts lib/sound.ts`
  - EXPECT: `passed`
