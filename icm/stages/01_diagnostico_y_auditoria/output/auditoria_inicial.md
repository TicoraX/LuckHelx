# Auditoría Técnica Inicial y Diagnóstico de Arquitectura — EStiri Squad

**Fecha:** 2026-10-06  
**Rama:** `feat/squad-polish-motion-audio`  
**Rol:** Tech Lead (EStiri Engineering)  
**Destinatario:** CEO (Usuario & Antigravity Core)  
**Etapa:** `icm/stages/01_diagnostico_y_auditoria`  
**Estado:** PENDIENTE DE REVISIÓN Y APROBACIÓN POR EL CEO

---

## 1. Resumen Ejecutivo

Se ha completado una inspección exhaustiva de extremo a extremo del código fuente de EStiri, abarcando el subsistema de audio (`lib/sound.ts`), la cinemática del carrete (`components/ChestReel.tsx`), la gramática visual e interacciones CSS/React (`components/`, `app/globals.css`), y la integridad transaccional de la moneda XP y base de datos (`lib/db.ts`, `lib/settings-store.ts`, `lib/batch-open.ts`, `lib/quests.ts`, `lib/trade-up.ts`).

La suite de pruebas automatizadas actual pasa al 100% (29 archivos de prueba, 198 tests en Vitest), lo que demuestra estabilidad en las pruebas unitarias existentes. Sin embargo, la auditoría del código real reveló **4 áreas críticas de fragilidad, desincronización y deuda técnica** que violan los principios de diseño de Emil Kowalski/Deliberate, las restricciones de audio Web Audio API, y los invariantes del backend:

1. **Audio Web Audio API y Sample Valve:** Disparidad en gain staging (3 métodos procedurales ignoran el volumen maestro), volumen desvinculado en el sample `.mp3` de Valve (suena al 100% independientemente del slider), falta de un `MasterGainNode` unificado, y un bucle de `requestAnimationFrame` en el carrete que consume ciclos leyendo la matriz del DOM inútilmente cuando el sample de audio ya está sonando.
2. **Cinemática del Carrete:** El carrete no sincroniza el soporte de accesibilidad: si el usuario tiene activado `@media (prefers-reduced-motion: reduce)`, el CSS anula la animación visual a 0ms, pero el temporizador JavaScript (`setTimeout`) deja al usuario congelado durante 6,5 segundos en silencio absoluto.
3. **Motion & UI Polish:** Violación recurrente de la regla de oro de Emil Kowalski: elementos interactivos principales (`.btn`, `.btn-action`, `.tab-btn`, `.theme-toggle`, `.inventory-card`, `.mobile-nav-item`) carecen del estado físico táctil `:active { transform: scale(0.97); }` o emplean un trasnochado `translate(0, 0)` sin respuesta elástica; la animación de modales `popIn` introduce un rebote tosco en `scale(1.03)` en lugar de una entrada asintótica limpia (`scale(0.95) -> 1` con `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`).
4. **Backend Hardening & Atomicidad de XP:** Se descubrieron **4 condiciones de carrera e inconsistencias de estado**:
   - `incrementXpBalance(db, amount)` en `lib/settings-store.ts` opera mediante lectura-modificación-escritura en memoria JS en lugar de una sentencia SQL atómica, permitiendo saldo negativo y pérdidas de actualización concurrentes.
   - `executeBatchOpen` (`lib/batch-open.ts`) comprueba el saldo fuera de la transacción SQLite.
   - `executeTradeUp` (`lib/trade-up.ts`) valida las existencias de inventario fuera de la transacción SQLite.
   - La tabla `quest_claims` (`lib/db.ts`) carece de restricción `UNIQUE (quest_id, claimed_date)`, permitiendo duplicar recompensas de XP si se envían peticiones paralelas.

---

## 2. Auditoría Detallada por Especialidad

### 2.1 Worker 2: Audio Synthesis & Haptic Sync (`lib/sound.ts`)

#### Hallazgos Críticos:
1. **Gain Staging Inconsistente:**
   - En `lib/sound.ts`:
     - `playReelTick`: Ganancia fija de `0.28` y ruido en `0.08` (**ignora `this.volume`**).
     - `playTaskComplete`: Ganancia fija de `0.15` (**ignora `this.volume`**).
     - `playChestOpen`: Ganancia fija de `0.2` (**ignora `this.volume`**).
     - `playClick`, `playLevelUp`, `playCaseUnlock` y `playRarityDrop` sí multiplican por `this.volume`.
   - Consecuencia: Si el usuario ajusta el volumen en Ajustes a `10%` o `20%`, los clicks de la ruleta y las fanfarrias de tareas suenan al volumen máximo ensordecedor.
2. **Volumen de Sample Valve Desacoplado:**
   - `this.opening` (`HTMLAudioElement`) se instancia en `prepareOpeningSample` y `startOpeningSample` sin asignar `audio.volume = this.volume`. Tampoco `setVolume(vol)` actualiza la instancia activa de `this.opening`.
   - Consecuencia: El `.mp3` de Valve suena siempre al 100% de volumen del sistema.
3. **Ausencia de Master Gain Node:**
   - Cada oscilador y buffer de ruido se conecta directamente a `this.ctx.destination`. No existe un nodo raíz maestro (`masterGainNode`) que actúe como compuerta única y segura de atenuación, rampa de silencio (evitando pops al pausar) y mute global.
4. **Bucle rAF Ocioso en ChestReel:**
   - `ChestReel.tsx` ejecuta `requestAnimationFrame(readTick)` de forma continua. Si `startOpeningSample()` arranca con éxito, `synthTicks` permanece en `false`, pero la función `readTick` sigue ejecutándose en cada refresco de pantalla durante 6,5 segundos.

---

### 2.2 Worker 1: Cinemática del Carrete & Easing (`components/ChestReel.tsx`)

#### Hallazgos Críticos:
1. **Curva de Desaceleración y Duración:**
   - El carrete utiliza `cubic-bezier(0.12, 0.8, 0.18, 1)` con una duración base de 6.500 ms. Para que el clac del sample de audio de CS2 (o la desaceleración de los ticks procedurales) coincida milimétricamente con el paso de cada ítem, la sincronización entre el espaciado de celdas (`CELL_WIDTH = 190`, `CELL_GAP = 10`) y la transformada debe garantizar que el último ítem no se desplace con tirones perceptibles en los últimos 200 ms.
2. **Lectura Matricial y Rendimiento:**
   - En `ChestReel.tsx:121`: `new DOMMatrixReadOnly(getComputedStyle(track).transform)`.
   - `getComputedStyle(track)` fuerza un recálculo de estilo en cada fotograma dentro de `readTick`. Cuando el audio sintetizado no está activo, este bucle debe pausarse de inmediato.
3. **Quiebre Severo en Accesibilidad (`prefers-reduced-motion`):**
   - En `app/globals.css:950`:
     ```css
     @media (prefers-reduced-motion: reduce) {
       .reel-track { transition: none !important; }
     }
     ```
   - En `components/ChestReel.tsx:130`:
     ```ts
     timerRef.current = setTimeout(() => {
       setLanded(true);
       ...
     }, spinDurationMs + 120);
     ```
   - **Falla de UX:** El CSS anula la transición inmediatamente, por lo que la tira se clava instantáneamente en el destino. Sin embargo, el componente no consulta `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, dejando al usuario bloqueado frente a una imagen estática durante 6,6 segundos esperando a que el timer venza para ver su premio.
4. **Deriva Temporal por Pestañas en Segundo Plano:**
   - Si el usuario cambia de pestaña durante el giro, el navegador congela o ralentiza los fotogramas de `requestAnimationFrame` pero `setTimeout` continúa (o se desfasa), generando una asincronía total entre el aterrizaje del carrete y el fin del sonido.

---

### 2.3 Worker 1 & 4: Motion, Microinteracciones & UI Polish (`components/`, `app/globals.css`)

#### Hallazgos Críticos:
1. **Infracción de Emil Kowalski — Animaciones de Entrada (Modales y Diálogos):**
   - En `app/globals.css:1087`:
     ```css
     @keyframes popIn {
       0% { opacity: 0; transform: scale(0.9); }
       70% { transform: scale(1.03); }
       100% { opacity: 1; transform: scale(1); }
     }
     ```
   - Esta animación genera un rebote tosco (`scale(1.03)`) en vez de una desaceleración precisa. Los estándares de `_shared/estandares_ui_audio.md` establecen:
     - Partir de `scale(0.95)` y `opacity: 0`.
     - Cero rebote de resorte barato en modales de información o confirmación.
     - Curva `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` con duración $\le 200\text{ ms}$.
2. **Infracción de Respuesta Física en `:active`:**
   - La regla maestra exige: *Todo elemento interactivo debe tener `:active { transform: scale(0.97); }`*.
   - Estado actual:
     - `.btn:active:not(:disabled)`: Utiliza `transform: translate(0, 0);` (herencia de un efecto de "sello" sin respuesta táctil en z-axis).
     - `.btn-action`: No tiene regla `:active`.
     - `.tab-btn`: No tiene regla `:active`.
     - `.theme-toggle` y conmutadores de audio: No tienen regla `:active`.
     - `.inventory-card`: No tiene respuesta de pulsación `:active` al hacer click para ver detalles o vender.
     - `.mobile-nav-item`: Carece de `:active`.
3. **Transiciones CSS Incompletas:**
   - Varios botones (`.btn-action`, `.theme-toggle`, `.mobile-nav-item`) tienen transiciones declaradas únicamente para `color`, `border-color` o `background`, omitiendo `transform 160ms cubic-bezier(0.23, 1, 0.32, 1)`. Esto causa que cualquier cambio de escala o interacción resulte cortante.
4. **Falta de Cobertura Global de `prefers-reduced-motion` (WCAG 2.2 AA):**
   - Actualmente, solo `.reel-track` y `.reel-prepare img` respetan la reducción de movimiento. Elementos como `skeletonLoading`, `xp-progress-fill`, `popIn`, `fadeInUp` y `AnimatedNumber` continúan animando agresivamente, incumpliendo el Criterio de Éxito 2.3.3 de WCAG 2.2.

---

### 2.4 Worker 3: Architecture & Backend Hardening (`lib/` y `app/api/`)

#### Hallazgos Críticos:
1. **Condición de Carrera en Saldo de XP (`incrementXpBalance`):**
   - En `lib/settings-store.ts:19-23`:
     ```ts
     export function incrementXpBalance(db: Db, amount: number): number {
       const next = getXpBalance(db) + amount;
       setMeta(db, 'xp_balance', String(next));
       return next;
     }
     ```
   - Este patrón es un clásico *Read-Modify-Write* en memoria JavaScript. Si dos solicitudes concurrentes (ej. completar dos tareas, o un canje y una venta) llegan simultáneamente:
     - Ambas leen el saldo actual (ej. 5.000 unidades).
     - Petición A suma 1.000 (calcula 6.000). Petición B suma 2.000 (calcula 7.000).
     - Ambas hacen `UPDATE`, y la última en escribir sobreescribe a la otra perdiendo 1.000 unidades de XP.
   - Además, la tabla `meta` almacena `value TEXT NOT NULL` sin ninguna restricción `CHECK`, permitiendo saldos negativos accidentales si no se valida en el motor SQL.
2. **Validación Fuera de Transacción en Apertura por Lotes (`lib/batch-open.ts`):**
   - Líneas 57-65:
     ```ts
     const currentBalance = getXpBalance(db);
     if (currentBalance < totalCost) throw new Error(...);
     ...
     db.transaction(() => {
       incrementXpBalance(db, -totalCost);
       ...
     })();
     ```
   - La comprobación `currentBalance < totalCost` ocurre **antes** de abrir la transacción SQLite. Dos aperturas concurrentes pueden superar el chequeo simultáneamente y dejar la cuenta en saldo negativo.
3. **Validación Fuera de Transacción en Contratos Trade-Up (`lib/trade-up.ts`):**
   - Líneas 59-88:
     ```ts
     const inventory = listInventory(db);
     // Verificación de existencias en memoria JS...
     db.transaction(() => {
       // Quema de 10 objetos mediante item_sales...
     })();
     ```
   - Si se lanzan dos peticiones de Trade-Up con los mismos 10 items al mismo tiempo, ambas validan con éxito el inventario y ambas ejecutan el `INSERT INTO item_sales`. El inventario resultante (`canjes - ventas`) queda corrupto con cantidades negativas.
4. **Falta de Constraint Único en Reclamación de Misiones Diarias (`lib/db.ts` & `lib/quests.ts`):**
   - En `lib/db.ts:100`:
     ```sql
     CREATE TABLE IF NOT EXISTS quest_claims (
       id TEXT PRIMARY KEY,
       quest_id TEXT NOT NULL,
       claimed_date TEXT NOT NULL,
       xp_awarded INTEGER NOT NULL,
       claimed_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     ```
   - **No existe** `UNIQUE (quest_id, claimed_date)`.
   - En `lib/quests.ts`: Se valida `quest.claimed` fuera de la transacción. Peticiones simultáneas a `/api/quests/claim` duplicarán la inserción y entregarán el doble o triple de XP por la misma misión completada.
5. **Formateo Manual de XP en Mensajes de Error:**
   - En `lib/batch-open.ts:59`:
     ```ts
     throw new Error(`XP insuficiente: requieres ${totalCost / 100} XP (tienes ${currentBalance / 100} XP)`);
     ```
   - Esto imprime valores en crudo con punto decimal en lugar de usar la función estandarizada de dominio `formatXp(units)` de `lib/xp.ts`.

---

## 3. Tablas Comparativas Quirúrgicas (Before | After | Why)

### 3.1 Audio & Haptic Feedback (`lib/sound.ts`, `components/ChestReel.tsx`)

| Componente / Archivo | Estado Actual (Before) | Estado Propuesto (After) | Justificación Técnica (Why) |
|---|---|---|---|
| `lib/sound.ts` (Gain Staging) | `playReelTick`, `playTaskComplete`, `playChestOpen` usan valores fijos (`0.28`, `0.15`, `0.2`). | Enrutamiento a través de un `masterGainNode` central o multiplicación estricta por `this.volume`. | Respetar la calibración de volumen maestro configurada por el usuario en Ajustes. |
| `lib/sound.ts` (Sample Valve) | `new Audio(url)` reproduce sin asignar `.volume`, ignorando el volumen de la app. | `audio.volume = this.volume` al inicializar y actualización reactiva en `setVolume(v)`. | Evitar explosión de volumen ensordecedor frente a los efectos sintetizados. |
| `lib/sound.ts` (Web Audio Graph) | Cada oscilador/buffer conecta a `ctx.destination` directamente. | `osc/noise -> nodeGain -> masterGain -> ctx.destination`. | Punto único de control de ganancia, prevención de picos acústicos y desacople limpio. |
| `components/ChestReel.tsx` (rAF Sync) | `readTick` ejecuta `requestAnimationFrame` en bucle continuo aun con `synthTicks = false`. | Bucle rAF activo **únicamente** cuando `synthTicks === true`. Si el sample reproduce, el bucle se cancela. | Elimina lecturas continuas e innecesarias de `DOMMatrixReadOnly` y `getComputedStyle`, liberando el hilo de pintado. |
| `components/ChestReel.tsx` (A11y Motion) | Espera 6.6s con la animación parada si `prefers-reduced-motion` está activo en el SO. | Detección de `matchMedia('(prefers-reduced-motion: reduce)')`: salta inmediatamente a resolución (0ms / modo `skip`). | WCAG 2.2 AA y respeto a la intención del usuario: no imponer tiempos de espera cosméticos cuando la animación fue suprimida. |

---

### 3.2 Motion & UI Polish (`app/globals.css`, `components/`)

| Elemento / Clase | Estado Actual (Before) | Estado Propuesto (After) | Justificación Técnica (Why) |
|---|---|---|---|
| `.modal-dialog` / `@keyframes popIn` | `scale(0.9) -> scale(1.03) -> scale(1)` con rebote elástico. | `transform: scale(0.95); opacity: 0;` a `scale(1); opacity: 1;` con curva `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` ($\le 200\text{ ms}$). | Cumplir con la gramática de Emil Kowalski / Deliberate: entradas ágiles y físicas sin rebote caricaturesco. |
| `.btn:active` | `box-shadow: none; transform: translate(0, 0);` | `transform: scale(0.97);` con transición `transform 120ms ease-out`. | Proporcionar retroalimentación táctil de pulsación auténtica en el eje z. |
| `.btn-action`, `.tab-btn`, `.theme-toggle` | Sin pseudo-clase `:active` o solo cambiando colores/bordes. | `:active:not(:disabled) { transform: scale(0.97); }` con `transition: transform 120ms ease-out, ...`. | Consistencia de microinteracciones en todo el espectro de componentes de la aplicación. |
| `.inventory-card` | Sin respuesta háptica/física al hacer click. | `&:hover { transform: translateY(-2px); } &:active { transform: scale(0.98); }`. | Transmite solidez física de "tarjeta coleccionable" al ser inspeccionada o seleccionada. |
| Global CSS (`prefers-reduced-motion`) | Solo afecta a `.reel-track` y `.reel-prepare img`. | Bloque global `@media (prefers-reduced-motion: reduce)` suprimiendo transiciones y animaciones decorativas (`* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }`). | Estándar de accesibilidad irrefutable WCAG 2.2 AA. |

---

### 3.3 Backend Hardening & Atomicidad XP (`lib/db.ts`, `lib/settings-store.ts`, etc.)

| Función / Módulo | Estado Actual (Before) | Estado Propuesto (After) | Justificación Técnica (Why) |
|---|---|---|---|
| `lib/settings-store.ts` (`incrementXpBalance`) | Read-Modify-Write en JS (`getXpBalance(db) + amount` -> `setMeta`). | Sentencia SQL atómica: `UPDATE meta SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT) WHERE key = 'xp_balance' AND (CAST(value AS INTEGER) + ?) >= 0`. | Previene condiciones de carrera concurrentes y garantiza matemáticamente que el saldo nunca caiga a negativo. |
| `lib/batch-open.ts` (`executeBatchOpen`) | Saldo verificado fuera de la transacción SQLite. | Mover la verificación de saldo e invocación de deducción **dentro** de la transacción SQLite atómica. | Atomicidad completa: previene sobregiro de saldo en invocaciones de batch simultáneas. |
| `lib/trade-up.ts` (`executeTradeUp`) | Existencias de inventario leídas y validadas fuera de la transacción. | Validación estricta y bloqueo de objetos dentro de `db.transaction(...)`. | Evita que contratos concurrentes quemen más objetos de los que el usuario posee en realidad. |
| `lib/db.ts` (`quest_claims`) | Tabla sin restricción única en `(quest_id, claimed_date)`. | `UNIQUE (quest_id, claimed_date)` mediante migración de esquema. | Bloquea a nivel de motor SQLite la duplicación accidental o maliciosa de XP en misiones diarias. |
| `lib/batch-open.ts` (Mensajes de error) | Concatenación manual `${totalCost / 100} XP`. | Uso de `formatXp(totalCost)` y `formatXp(currentBalance)`. | Consistencia con el dominio monetario de EStiri (`lib/xp.ts`). |

---

## 4. Clasificación de Decisiones Técnicas (Motor /gstack /autoplan)

De acuerdo con los principios de decisión del proyecto (`icm/_shared/principios_gstack.md`), se clasifican las resoluciones de esta auditoría:

### 4.1 Decisiones Mecánicas (Autónomas)
* Corregir el factor de escala de ganancia en `playReelTick`, `playTaskComplete`, `playChestOpen` para respetar `this.volume`.
* Asignar `audio.volume = this.volume` en el elemento de audio de Valve.
* Suspender el bucle rAF en `ChestReel.tsx` cuando `synthTicks` esté desactivado.
* Añadir `:active { transform: scale(0.97); }` a `.btn`, `.btn-action`, `.tab-btn`, `.theme-toggle` y `.mobile-nav-item`.
* Unificar el formateo de errores en `batch-open.ts` usando `formatXp`.
* Respetar `prefers-reduced-motion` a nivel de estilos globales.

### 4.2 Decisiones de Gusto (Taste) — Recomendación del Tech Lead
1. **Comportamiento de ChestReel ante `prefers-reduced-motion`:**
   - *Opción A:* Salto instantáneo en 0 ms directo a la revelación del ítem ganador.
   - *Opción B:* Un fade-in suave de 200 ms mostrando la caja abriéndose y revelando el premio sin el desfile de la tira.
   - *Recomendación del Tech Lead:* **Opción A (Salto instantáneo 0 ms)** mediante la ruta `skip` existente. La persona que activa reducción de movimiento busca evitar la espera decorativa y los mareos vestibulares. El canje ya ocurrió en el servidor; la animación es un adorno.
2. **Arquitectura del Grafo Web Audio API:**
   - *Recomendación del Tech Lead:* Crear un nodo `this.masterGain = this.ctx.createGain()` conectado a `this.ctx.destination` al instanciar el contexto. Todos los osciladores y buffers conectan a través de él. Esto proporciona una única fuente de verdad para el volumen general, eliminando multiplicaciones dispersas propensas a olvidos.

### 4.3 User Challenges (Objeciones Técnicas y Puntos Ciegos Detectados)
1. **Integridad de Saldo de XP frente a Concurrencia:**
   - *Alerta:* El manejo actual de `xp_balance` en `meta` mediante strings ("0", "5000") y helpers JS expone a la aplicación a fallos de concurrencia silenciosos si la app escala o si el usuario ejecuta acciones rápidas en pestañas múltiples.
   - *Propuesta del Tech Lead:* Se debe actualizar `incrementXpBalance` para que ejecute una transacción SQLite con cláusula de protección:
     ```sql
     UPDATE meta 
     SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT) 
     WHERE key = 'xp_balance' AND (CAST(value AS INTEGER) + ?) >= 0;
     ```
     Si `changes === 0` en una deducción, lanzar error de invariante de dominio ("Saldo de XP insuficiente").
2. **Constraint de Misiones Diarias en SQLite:**
   - *Alerta:* No basta con validar en el código de aplicación; las bases de datos SQLite deben actuar como barrera inquebrantable.
   - *Propuesta del Tech Lead:* Incorporar una migración quirúrgica en `initSchema` para añadir un índice único `CREATE UNIQUE INDEX IF NOT EXISTS idx_quest_claims_unique ON quest_claims (quest_id, claimed_date);`.

---

## 5. Estrategia de Asignación a Workers Especializados (Etapa 02/03)

Una vez aprobada esta auditoría por el CEO, la etapa 02 emitirá las especificaciones técnicas precisas para los siguientes workers:

```
[Tech Lead / Orquestador ICM]
        │
        ├──► Worker 1: Motion & UI Polish
        │      - Refactor de @keyframes popIn (escala 0.95 -> 1, curva cubic-bezier)
        │      - Incorporación de :active { transform: scale(0.97); } en toda la botonera
        │      - Refactor de ChestReel.tsx para bypass instantáneo con prefers-reduced-motion
        │
        ├──► Worker 2: Audio Synthesis & Haptic Sync
        │      - Creación de MasterGainNode en lib/sound.ts
        │      - Calibración de volumen en todos los métodos de oscilador y sample HTMLAudio
        │      - Optimización de ChestReel rAF loop (idle cuando el sample de Valve suena)
        │
        ├──► Worker 3: Architecture & Backend Hardening
        │      - Atomicidad de incrementXpBalance con protección de saldo no-negativo en SQLite
        │      - Blindaje transaccional en batch-open.ts y trade-up.ts
        │      - Migración de índice único para quest_claims en lib/db.ts
        │
        └──► Worker 4: Acceptance Gates & A11y
               - Reglas globales prefers-reduced-motion en globals.css (WCAG 2.2 AA)
               - Creación de tests de concurrencia y validación en suite Vitest
               - Auditoría de compuertas contra GATES.md
```

---

## 6. Estado y Solicitud de Aprobación

Este informe formaliza el cierre de la etapa `01_diagnostico_y_auditoria`. De acuerdo con el contrato de orquestación en `icm/CLAUDE.md`, **no se avanzará a la etapa 02 de diseño y especificación ni se modificará código base hasta que el CEO valide este diagnóstico**.

👉 **Esperando revisión y confirmación del CEO.**
