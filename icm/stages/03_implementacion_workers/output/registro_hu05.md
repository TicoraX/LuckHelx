# Registro de Implementación — HU-05: Case Battles 1v1 contra Bot Simulado

**Fecha:** 2026-10-06  
**Rama:** `feat/sprint-2-case-battles`  
**Rol:** Tech Lead (EStiri / LuckHelx Engineering)  
**Etapa:** `icm/stages/03_implementacion_workers`  
**Destinatario:** CEO (Usuario + Antigravity Core)  
**Estado:** IMPLEMENTACIÓN COMPLETADA Y VERIFICADA AL 100%

---

## 1. Resumen de la Ejecución

Se ha implementado quirúrgicamente la funcionalidad completa de **Case Battles 1v1 contra Bot Simulado (HU-05)** cumpliendo con los estándares de diseño y arquitectura de LuckHelx:
- Respeto incondicional de centésimas enteras de XP (`lib/xp.ts`).
- Inmutabilidad estricta del ledger de `redemptions` y preservación de la integridad del inventario (`listInventory`).
- Cero dependencias infladas (síntesis de audio procedural Web Audio API, animaciones CSS puro, persistencia SQLite transaccional).
- Accesibilidad de primer nivel (WCAG 2.2 AA) con resolución instantánea de 0 ms ante `prefers-reduced-motion: reduce`.

### Métricas de Verificación Terminal
* **Vitest Suite:** 211 tests aprobados en 30 archivos de prueba (+8 tests nuevos en `lib/case-battle.test.ts`), 0 fallos, 0 regresiones.
* **Next.js Production Build:** Compilación limpia de producción (`next build`) con las 31 rutas estáticas y dinámicas compiladas exitosamente.

---

## 2. Registro Quirúrgico de Cambios por Worker

### 2.1 Worker 1: Motion & UI Polish
* **`components/CaseBattleModal.tsx`:**
  - Implementación de arena visual dual con dos carretes sincronizados en paralelo (Jugador vs Bot).
  - Reutilización de la lógica física y matemática de `buildReel` (`lib/chest-reel.ts`), con anchos de celda adaptados (`DUAL_CELL_WIDTH = 140px`, `DUAL_CELL_GAP = 10px`, `WINNER_INDEX = 34`).
  - Animación asintótica con doble `requestAnimationFrame` para garantizar el commit DOM antes del inicio de la transición CSS (`cubic-bezier(0.12, 0.8, 0.18, 1)`).
  - Marcadores centrales de alineación con resplandor dorado y resaltado de la celda ganadora.
  - Botón de salto de animación ("Saltar Giro ⏩") y bypass instantáneo a 0 ms si `prefers-reduced-motion: reduce` está activo.

### 2.2 Worker 2: Audio Synthesis & Haptic Sync
* **`lib/sound.ts`:**
  - Adición de `playBattleVictory()`: Fanfarria mayor triunfal ascendente en Web Audio API (C5 -> E5 -> G5 -> C6) usando osciladores triangulares con decaimiento natural de 350 ms, enrutada directamente al `masterGain`.
  - Adición de `playBattleDefeat()`: Glissando descendente en diente de sierra (220 Hz a 75 Hz) con curva exponencial de ganancia de 400 ms, para una señalización sonora de derrota sin estridencia.
  - Sincronización auditiva: `playCaseUnlock()` al soltar los carretes y reproducción automática del veredicto al aterrizar.

### 2.3 Worker 3: Architecture & Backend Hardening
* **`lib/db.ts` (Esquema e Índices):**
  - Creación de tabla `case_battles` e índice cronológico `idx_case_battles_created_at`.
* **`lib/case-battle.ts` (Lógica de Dominio y Transaccionalidad):**
  - Catálogo de 5 bots simulados con avatares nativos y personalidades (`Lord Gaben`, `Clucky`, `Neo-Sniper`, `Jarvis AI`, `Boris Rush-B`).
  - Función de valorización `getBattleItemValue(db, name, rarity)` con consulta a caché `skin_prices` y fallback determinista a `TIER_FALLBACK_USD` (`legendary`: $80, `epic`: $15, `rare`: $2, `common`: $0.50).
  - Encapsulamiento de la batalla en bloque `db.transaction(...)`:
    - Validación atómica de balance de XP (`currentBalance >= totalCost`).
    - Débito de XP mediante `incrementXpBalance(db, -totalCost)`.
    - Sorteos independientes con `pickChestItem` siguiendo `TIER_ODDS`.
    - Resolución de ganador (*player*, *bot*, *tie*).
    - Impacto en `redemptions`:
      - **Victoria del jugador:** 2 filas insertadas (ítem propio con costo, ítem del bot con costo 0). Inventario: +2 skins.
      - **Derrota del jugador:** 1 fila insertada con `won_item_id = NULL`. Inventario: 0 skins.
      - **Empate:** 1 fila insertada con ítem propio. Inventario: +1 skin.
    - Idempotencia estricta mediante `operationId` para prevenir doble débito ante reintentos de red o clics repetidos.
* **`app/api/case-battle/route.ts`:**
  - Métodos `GET` (historial y catálogo de bots) y `POST` (ejecución atómica del duelo).
* **`app/rewards/page.tsx`:**
  - Puntos de entrada para duelos 1v1: botón destacado en toolbar de cofres y botón contextual `⚔️ 1v1` en cada fila del ledger de cofres.

### 2.4 Worker 4: Acceptance Gates & A11y
* **`lib/case-battle.test.ts`:**
  - 8 pruebas de integración con base de datos en memoria SQLite real:
    1. Rechazo por saldo insuficiente sin deducción de XP.
    2. Excepciones ante cofre inexistente o cofre sin ítems.
    3. Victoria de jugador acredita exactamente 2 skins en `listInventory`.
    4. Victoria de bot no acredita skins al jugador (0 skins en `listInventory`).
    5. Empate acredita exactamente 1 skin (retención de drop propio).
    6. Idempotencia ante reenvío de `operationId`.
    7. Fallback correcto de valorizaciones por rareza.
    8. Selección aleatoria de bot y sorteo independiente cuando no hay overrides.
* **`GATES.md`:**
  - Actualización de G1 (31 rutas), G2 (211 tests en 30 archivos) y formalización de la compuerta **G10** (HU-05 Case Battles 1v1 Transactional & Ledger Integrity).

---

## 3. Matriz de Archivos Afectados

| Archivo | Estado | Responsable | Propósito |
|---|---|---|---|
| `lib/db.ts` | Modificado | Worker 3 | DDL tabla `case_battles` e índice en `initSchema`. |
| `lib/db.test.ts` | Modificado | Worker 4 | Actualización de lista esperada de tablas en base de datos. |
| `lib/case-battle.ts` | Nuevo | Worker 3 | Lógica de dominio, bots, valorización y transacción atómica. |
| `lib/case-battle.test.ts` | Nuevo | Worker 4 | Batería de 8 tests de integración en Vitest. |
| `lib/sound.ts` | Modificado | Worker 2 | Síntesis Web Audio de victoria y derrota en duelos. |
| `components/CaseBattleModal.tsx` | Nuevo | Worker 1 & 4 | Componente de arena dual con carretes sincronizados y A11y. |
| `app/api/case-battle/route.ts` | Nuevo | Worker 3 | Endpoint REST para batallas 1v1 e historial. |
| `app/rewards/page.tsx` | Modificado | Worker 1 & 3 | Puntos de entrada UI y modal de batalla en vista de recompensas. |
| `GATES.md` | Modificado | Worker 4 | Actualización de métricas de compuertas y nueva compuerta G10. |
