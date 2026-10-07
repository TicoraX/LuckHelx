# Plan de Ejecución Técnico — Refactor Motion, Audio & Backend Hardening

**Fecha:** 2026-10-06  
**Rama:** `feat/squad-polish-motion-audio`  
**Rol:** Tech Lead (EStiri Engineering)  
**Etapa:** `icm/stages/02_diseno_y_especificacion`  
**Destinatario:** CEO (Usuario & Antigravity Core)  
**Estado:** PENDIENTE DE REVISIÓN Y APROBACIÓN POR EL CEO

---

## 1. Contexto y Objetivos Técnicos

Con base en el diagnóstico aprobado en la Etapa 01 (`icm/stages/01_diagnostico_y_auditoria/output/auditoria_inicial.md`), este documento formaliza la especificación técnica quirúrgica para la Etapa 03. 

El objetivo es elevar la calidad de EStiri a un estándar AAA:
1. **Motion & UI Polish:** Eliminar rebotes no físicos en modales, instaurar retroalimentación táctil `:active { transform: scale(0.97); }` en toda la interfaz y proveer soporte instantáneo para `prefers-reduced-motion` en el carrete.
2. **Audio Synthesis & Haptics:** Calibrar el gain staging de Web Audio API bajo un `MasterGainNode`, vincular el volumen del sample `.mp3` de Valve y optimizar el bucle `requestAnimationFrame` del carrete para que descanse cuando el audio oficial esté activo.
3. **Backend Hardening & Atomicidad de XP:** Proteger la moneda de la aplicación contra carreras y saldos negativos mediante transacciones atómicas en SQLite, encapsular validaciones dentro de las transacciones en aperturas por lote y trade-up, e imponer un índice único inmutable en `quest_claims`.
4. **Verificación y Compuertas (GATES.md):** Nuevas pruebas automatizadas Vitest que certifiquen las defensas de concurrencia y la reducción de movimiento sin romper ninguna de las 198 pruebas existentes.

---

## 2. Principios Rectores de Decisión (/gstack /autoplan)

Todas las especificaciones técnicas se rigen por los 6 principios inmutables:
1. **Choose Completeness:** Cubrir el flujo completo de apertura (con sample y procedural), casos de borde de saldo insuficiente y estados de concurrencia.
2. **Boil Lakes:** Resolver el radio de impacto completo en los componentes interactivos de la aplicación sin dejar botones huérfanos sin estado `:active`.
3. **Pragmatic:** Resolver la concurrencia directamente en las primitivas transaccionales de SQLite (`better-sqlite3`), sin crear bibliotecas intermedias de bloqueo.
4. **DRY & Reuse:** Reutilizar `formatXp` para todo mensaje de error de saldo y apoyarse en `matchMedia` nativo del navegador.
5. **Explicit over Clever:** Código evidente de actualización en SQLite (`UPDATE meta ...`) en lugar de capas complejas de concurrencia optimista en memoria.
6. **Bias toward Action:** Cada cambio de especificación tiene una prueba unitaria o de integración ejecutable en Vitest.

---

## 3. Contratos de Intervención por Worker Especializado

### 3.1 Worker 1: Motion & UI Polish (/emil-design-eng, /animation-vocabulary, /deliberate)

#### Archivos en Radio de Impacto:
- `app/globals.css`
- `components/ChestReel.tsx`

#### Tarea 1.1: Refactorización de `@keyframes popIn` y Entrada de Modales
- **Problema:** `popIn` pasa por `scale(1.03)`, creando un rebote elástico no físico ajeno al lenguaje visual de EStiri.
- **Especificación:**
  - Sustituir `@keyframes popIn` en `app/globals.css`:
    ```css
    @keyframes popIn {
      0% {
        opacity: 0;
        transform: scale(0.95);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }
    ```
  - En `.modal-dialog`:
    ```css
    .modal-dialog {
      /* Reemplazar animation: popIn 0.2s ease-out; */
      animation: popIn 180ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    ```

#### Tarea 1.2: Feedback Táctil Físico en `:active`
- **Problema:** `.btn` utiliza `translate(0, 0)`, mientras que `.btn-action`, `.tab-btn`, `.theme-toggle`, `.mobile-nav-item` y `.inventory-card` carecen de estado `:active`.
- **Especificación:**
  - En `app/globals.css`:
    ```css
    /* Botones primarios, secundarios y de peligro */
    .btn:active:not(:disabled) {
      box-shadow: none;
      transform: scale(0.97);
      transition-duration: 60ms;
    }

    /* Botones de acción en tablas, misiones y formularios */
    .btn-action {
      transition: transform 0.12s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.15s ease, background 0.15s ease;
    }
    .btn-action:active:not(:disabled) {
      transform: scale(0.97);
    }

    /* Pestañas de navegación de tienda/catálogo */
    .tab-btn {
      transition: transform 0.12s cubic-bezier(0.23, 1, 0.32, 1), background 0.15s ease, color 0.15s ease;
    }
    .tab-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    /* Botones de conmutación de tema y sonido en header */
    .theme-toggle {
      transition: transform 0.12s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.15s ease, color 0.15s ease;
    }
    .theme-toggle:active {
      transform: scale(0.95);
    }

    /* Items de navegación móvil inferior */
    .mobile-nav-item:active {
      transform: scale(0.95);
    }

    /* Tarjetas interactivas de inventario */
    .inventory-card {
      transition: transform 0.16s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .inventory-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .inventory-card:active {
      transform: scale(0.98);
    }
    ```

#### Tarea 1.3: Sincronización A11y Instantánea en `ChestReel.tsx`
- **Problema:** Cuando el usuario tiene activado `prefers-reduced-motion: reduce`, el CSS anula la transición del carrete a 0ms, pero `ChestReel.tsx` ejecuta un `setTimeout` de 6.6 segundos, bloqueando al usuario en una pantalla congelada.
- **Especificación:**
  - En `components/ChestReel.tsx`:
    - Detectar al montar si la reducción de movimiento está activa:
      ```ts
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ```
    - Si `skip || prefersReduced`:
      ```ts
      if (skip || prefersReduced) {
        setPreparing(false);
        setOffset(targetOffset);
        setLanded(true);
        const winnerRarity = (reelItems[WINNER_INDEX]?.rarity ?? 'common') as 'common' | 'rare' | 'epic' | 'legendary';
        soundFX.playRarityDrop(winnerRarity);
        doneRef.current();
        return;
      }
      ```
    - Esto elimina los 6,6 segundos de espera vacía y entrega el resultado de forma instantánea y accesible.

---

### 3.2 Worker 2: Audio Synthesis & Haptic Sync (lib/sound.ts, Web Audio API)

#### Archivos en Radio de Impacto:
- `lib/sound.ts`
- `components/ChestReel.tsx`

#### Tarea 2.1: MasterGainNode y Calibración Unificada en `lib/sound.ts`
- **Problema:** Ganancias en duro en `playReelTick`, `playTaskComplete` y `playChestOpen`. Sample `.mp3` de Valve sonando al 100% sin importar la configuración.
- **Especificación:**
  - En `lib/sound.ts`:
    - Añadir campo privado:
      ```ts
      private masterGain: GainNode | null = null;
      ```
    - En `initCtx()`:
      ```ts
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      }
      ```
    - En `setVolume(vol: number)`:
      ```ts
      this.volume = vol;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
      }
      if (this.opening) {
        this.opening.volume = vol;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('sound_volume', String(vol));
      }
      ```
    - En `prepareOpeningSample` y `startOpeningSample`:
      ```ts
      audio.volume = this.volume;
      ```
    - Conectar los nodos de síntesis al `this.masterGain` en lugar de `this.ctx.destination`.
    - Normalizar las ganancias base de los sintetizadores:
      - `playReelTick`: oscilador base `0.28`, ruido `0.08` conectados a `this.masterGain`.
      - `playTaskComplete`: ganancia base `0.15` conectada a `this.masterGain`.
      - `playChestOpen`: ganancia base `0.20` conectada a `this.masterGain`.
      - `playClick`: ganancia base `0.08` conectada a `this.masterGain`.
      - `playLevelUp`: ganancia base `0.12` conectada a `this.masterGain`.
      - `playCaseUnlock`: ganancia base `0.15` conectada a `this.masterGain`.
      - `playRarityDrop`: ganancia base `0.10` conectada a `this.masterGain`.
    - Al enrutarse todos a través de `masterGain`, el volumen maestro se aplica de forma lineal y exacta en un único punto arquitectónico.

#### Tarea 2.2: Suspensión de Bucle rAF Ocioso en `ChestReel.tsx`
- **Problema:** `requestAnimationFrame(readTick)` se ejecuta 60-120 veces por segundo leyendo `DOMMatrixReadOnly` aunque `synthTicks` sea falso porque el sample `.mp3` de Valve está sonando.
- **Especificación:**
  - En `components/ChestReel.tsx`:
    - El bucle `readTick` solo debe programar el siguiente frame si `synthTicks` está activo:
      ```ts
      const readTick = () => {
        if (!synthTicks) return;
        const track = trackRef.current;
        if (track) {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
          const currentCell = Math.floor((-matrix.m41 + viewportWidth / 2) / cell);
          if (lastCellRef.current !== null && currentCell !== lastCellRef.current) {
            soundFX.playReelTick();
          }
          lastCellRef.current = currentCell;
        }
        frameRef.current = requestAnimationFrame(readTick);
      };
      ```
    - Si el sample oficial `.mp3` falla o es bloqueado por la política de autoplay:
      ```ts
      soundFX.startOpeningSample().catch(() => {
        synthTicks = true;
        frameRef.current = requestAnimationFrame(readTick);
      });
      ```
    - Si el sample oficial reproduce con éxito, `frameRef.current` no se encola, eliminando el 100% del cálculo innecesario en el hilo de renderizado.

---

### 3.3 Worker 3: Architecture & Backend Hardening (/thermos, /ponytail, SQLite transactions)

#### Archivos en Radio de Impacto:
- `lib/settings-store.ts`
- `lib/batch-open.ts`
- `lib/trade-up.ts`
- `lib/db.ts`
- `lib/quests.ts`

#### Tarea 3.1: Atomicidad y Protección de Saldo en `incrementXpBalance`
- **Problema:** Read-Modify-Write en memoria JS susceptible a carreras y saldos negativos.
- **Especificación:**
  - En `lib/settings-store.ts`:
    ```ts
    export function incrementXpBalance(db: Db, amount: number): number {
      if (!Number.isInteger(amount)) {
        throw new Error(`incrementXpBalance requiere un monto entero en unidades, recibido: ${amount}`);
      }

      let nextBalance = 0;
      db.transaction(() => {
        const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('xp_balance') as
          | { value: string }
          | undefined;
        const current = row ? Number(row.value) : 0;
        const next = current + amount;

        if (next < 0) {
          throw new Error(`Saldo de XP insuficiente: se intento debitar ${Math.abs(amount)} con saldo disponible de ${current}`);
        }

        db.prepare(
          'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        ).run('xp_balance', String(next));

        nextBalance = next;
      })();

      return nextBalance;
    }
    ```
  - **Invariante:** Cualquier intento de dejar el saldo por debajo de 0 arroja una excepción que aborta automáticamente la transacción SQLite activa.

#### Tarea 3.2: Blindaje Transaccional en `executeBatchOpen` (`lib/batch-open.ts`)
- **Problema:** Verificación de saldo previa a `db.transaction(...)`.
- **Especificación:**
  - Mover la verificación dentro de la transacción atómica:
    ```ts
    db.transaction(() => {
      const currentBalance = getXpBalance(db);
      if (currentBalance < totalCost) {
        throw new Error(`XP insuficiente: requieres ${formatXp(totalCost)} XP (tienes ${formatXp(currentBalance)} XP)`);
      }

      incrementXpBalance(db, -totalCost);

      for (let i = 0; i < count; i++) {
        // Inserción de redemptions y acumulación de items ganados...
      }

      if (input.operationId) {
        // Guardado de idempotencia...
      }
    })();
    ```
  - Reemplazar la interpolación manual `${totalCost / 100} XP` por `formatXp(totalCost)`.

#### Tarea 3.3: Blindaje Transaccional en `executeTradeUp` (`lib/trade-up.ts`)
- **Problema:** Lectura del inventario fuera de la transacción, permitiendo que peticiones paralelas quemen los mismos objetos.
- **Especificación:**
  - Envolver la lectura y validación dentro de `db.transaction(...)`:
    ```ts
    db.transaction(() => {
      const inventory = listInventory(db);
      const inventoryMap = new Map(inventory.map((item) => [item.id, item]));

      for (const [id, count] of Object.entries(requestedCounts)) {
        const owned = inventoryMap.get(id);
        if (!owned) {
          throw new Error(`no tienes el objeto ${id} en tu inventario`);
        }
        if (owned.rarity !== input.inputRarity) {
          throw new Error(`todos los objetos deben ser de rareza ${input.inputRarity}`);
        }
        if (owned.count < count) {
          throw new Error(`no tienes suficientes copias de ${owned.name} (tienes ${owned.count}, requieres ${count})`);
        }
      }

      // 1. Burn 10 items via item_sales
      // 2. Add upgraded item to redemptions
      // 3. Record in trade_ups table
    })();
    ```

#### Tarea 3.4: Migración de Índice Único en `quest_claims` (`lib/db.ts` & `lib/quests.ts`)
- **Problema:** Duplicación de recompensas de misiones diarias ante llamadas concurrentes a `/api/quests/claim`.
- **Especificación:**
  - En `lib/db.ts` (`initSchema`):
    ```sql
    CREATE UNIQUE INDEX IF NOT EXISTS idx_quest_claims_unique ON quest_claims (quest_id, claimed_date);
    ```
  - En `lib/quests.ts` (`claimQuest`):
    ```ts
    try {
      db.transaction(() => {
        db.prepare(
          'INSERT INTO quest_claims (id, quest_id, claimed_date, xp_awarded, claimed_at) VALUES (?, ?, ?, ?, ?)'
        ).run(claimId, quest.id, dateKey, quest.bonusXp, now);

        incrementXpBalance(db, quest.bonusXp);
      })();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        throw new Error('esta mision ya fue reclamada');
      }
      throw err;
    }
    ```

---

### 3.4 Worker 4: Acceptance Gates & A11y (WCAG 2.2 AA, TDD, GATES.md)

#### Archivos en Radio de Impacto:
- `app/globals.css`
- `GATES.md`
- `lib/settings-store.test.ts`
- `lib/batch-open.test.ts`
- `lib/quests.test.ts`
- `lib/chest-reel.test.ts`

#### Tarea 4.1: Cobertura Global de `prefers-reduced-motion` (WCAG 2.2 AA)
- **Especificación:**
  - Añadir al final de `app/globals.css`:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    ```

#### Tarea 4.2: Batería de Pruebas Unitarias de Hardening
- **Especificación:**
  - En `lib/settings-store.test.ts`:
    - Test: `rejects debiting balance below zero and leaves balance intact`.
    - Test: `rejects non-integer amount in incrementXpBalance`.
  - En `lib/batch-open.test.ts`:
    - Test: `fails transaction and preserves balance if XP drops during batch open`.
    - Test: `uses formatXp format in insufficient balance error message`.
  - En `lib/quests.test.ts`:
    - Test: `rejects concurrent double claiming of same quest on same day via unique constraint`.
  - En `lib/chest-reel.test.ts`:
    - Test de exportación/verificación del cálculo de offset para modo reducido.

#### Tarea 4.3: Actualización del Ledger `GATES.md`
- Incorporar tres nuevas compuertas explícitas:
  - **G7:** Audio Gain & Master Attenuation (Web Audio API graph con MasterGainNode y sample volume sync).
  - **G8:** Motion Polish & A11y Compliance (Curvas Kowalski sin rebote en modales, :active scale(0.97), prefers-reduced-motion instantáneo).
  - **G9:** XP Transactional Integrity & Zero Race Conditions (Prevención de saldo negativo y doble reclamación de misiones en SQLite).

---

## 4. Matriz de Trazabilidad y Blast Radius

| Worker | Archivo a Modificar | Tipo de Cambio | Riesgo | Mitigación |
|---|---|---|---|---|
| Worker 1 | `app/globals.css` | CSS (@keyframes popIn, :active, reduced-motion) | Muy Bajo | Selectores acotados; no altera layout ni grid. |
| Worker 1 | `components/ChestReel.tsx` | React / TS (A11y reduced-motion skip) | Bajo | Reutiliza la rama `skip` ya probada. |
| Worker 2 | `lib/sound.ts` | TS (MasterGainNode, gain calibration, audio.volume) | Bajo | Mantiene la misma API pública (`soundFX.play*`). |
| Worker 2 | `components/ChestReel.tsx` | React / TS (rAF idle cuando corre el sample) | Bajo | Cancela rAF limpiamente en `useEffect` cleanup. |
| Worker 3 | `lib/settings-store.ts` | TS (Transacción atómica y guardas < 0) | Medio | 100% cubierto por `settings-store.test.ts`. |
| Worker 3 | `lib/batch-open.ts` | TS (Check de saldo dentro de transacción) | Bajo | 100% cubierto por `batch-open.test.ts`. |
| Worker 3 | `lib/trade-up.ts` | TS (Check de inventario dentro de transacción) | Bajo | 100% cubierto por `trade-up.test.ts`. |
| Worker 3 | `lib/db.ts` | SQLite (Índice único en `quest_claims`) | Bajo | `CREATE UNIQUE INDEX IF NOT EXISTS` idempotente. |
| Worker 3 | `lib/quests.ts` | TS (Captura de error de unicidad) | Bajo | Mantiene mensaje de error idéntico. |
| Worker 4 | `GATES.md` | Markdown (Nuevas compuertas G7-G9) | Nulo | Documentación verificable. |
| Worker 4 | `lib/*.test.ts` | Tests Vitest (Casos de concurrencia y límites) | Nulo | Solo añade nuevos casos de prueba. |

---

## 5. Criterios de Aceptación y Compuertas de Verificación

Para declarar exitosa la implementación en la Etapa 04, el sistema debe cumplir sin excepción:
1. `npm test`: Los 198 tests anteriores más los nuevos tests de concurrencia deben pasar al 100% (`200+ passed`).
2. `npm run build`: Compilación de Next.js sin errores de tipado o rutas estáticas/dinámicas.
3. Cero clicks audibles rotos con volumen a 0% o 10%.
4. Respuesta física `:active` visible en inspección de browser en todos los elementos interactivos.
5. `prefers-reduced-motion: reduce` resuelve el carrete de inmediato sin colgar la UI 6.6 segundos.

---

## 6. Solicitud de Aprobación al CEO

El plan detalla con precisión quirúrgica cada línea a modificar, sus contratos y pruebas asociadas.  
Se encuentra formalizado en `icm/stages/02_diseno_y_especificacion/output/plan_ejecucion.md`.

👉 **Esperando la aprobación del CEO para habilitar el despacho de los 4 Workers en la Etapa 03.**
