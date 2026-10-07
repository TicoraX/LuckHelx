# Especificación Técnica HU-05: Case Battles 1v1 contra Bot Simulado

**Módulo:** Recompensas & Gamificación (EStiri / LuckHelx)  
**Fecha:** 2026-10-06  
**Autor:** Tech Lead (EStiri Engineering)  
**Destinatario:** CEO (Usuario + Antigravity Core)  
**Rama:** `feat/sprint-2-case-battles`  
**Estado:** ESPECIFICACIÓN APROBADA PARA IMPLEMENTACIÓN

---

## 1. Resumen Ejecutivo y Alcance

La HU-05 introduce la mecánica competitiva de **Case Battles 1v1** contra un bot simulado en LuckHelx. Dos participantes (el usuario y un bot contrincante) abren de forma simultánea e independiente el mismo tipo de cofre. El participante que obtenga el ítem de mayor valor de mercado (o rareza equivalente) gana el duelo y se lleva **ambos ítems** (*winner-takes-all*).

### Reglas Inmutables de Negocio
1. **Unidad de Valor (XP):** Todo costo y movimiento financiero se gestiona en centésimas enteras de XP (`lib/xp.ts`, 1 XP = 100 unidades). El usuario paga la entrada del duelo equivalente a `costo_cofre + costo_llave`.
2. **Inmutabilidad del Histórico:** La tabla `redemptions` es el ledger de auditoría y la única fuente de verdad para el inventario activo (`listInventory`). No se borran ni reescriben filas históricas.
3. **Distribución de Drops:** Cada tirada (jugador y bot) se sortea de forma rigurosamente independiente usando las probabilidades calibradas en `lib/rewards.ts` (`TIER_ODDS`: Common 79.92%, Rare 15.98%, Epic 3.84%, Legendary 1.50%).
4. **Cero Dependencias Infladas (Ponytail/Karpathy):** Síntesis de sonido procedural vía Web Audio API nativo (`lib/sound.ts`), persistencia en SQLite (`better-sqlite3`), y maquetado CSS puro responsivo.
5. **Accesibilidad Obligatoria (A11y):** Si `prefers-reduced-motion: reduce` o el botón "Saltar" están activos, las animaciones se resuelven a 0 ms sin delay ni rAF colgado.

---

## 2. Evaluación de Trade-Offs de Diseño (/gstack /autoplan)

### Trade-Off 1: Persistencia `case_battles` vs `redemptions`
* **Opción A (Sólo `redemptions`):** Grabar las batallas sobrecargando columnas en `redemptions`.
  - *Desventaja:* Mezcla conceptos de aperturas solistas con duelos 1v1 y obligaría a añadir columnas anulables (`bot_name`, `bot_item_id`, etc.) en la tabla financiera principal.
* **Opción B (`case_battles` + `redemptions`, Seleccionada):** 
  - La tabla `case_battles` almacena la metadata completa del enfrentamiento (ID, cofre, bot contrincante, ítems sorteados de ambos bandos, valores monetarios calculados, ganador y timestamp).
  - La tabla `redemptions` refleja los impactos en el inventario y el balance de XP:
    - **Victoria del jugador:** Se debita el costo del cofre en 1 fila principal con el ítem del jugador, y se inserta una segunda fila con `xp_spent = 0` conteniendo el ítem del bot ganado. El inventario aumenta en **2 skins**.
    - **Derrota del jugador:** Se debita el costo del cofre en 1 fila de redemption con `won_item_id = NULL`. El inventario recibe **0 skins** (el bot se queda con ambos ítems).
    - **Empate:** El jugador conserva su propio drop (`won_item_id = player_item_id`). El inventario aumenta en **1 skin**.

### Trade-Off 2: Regla de Evaluación y Desempates
* **Valorización:** El valor de cada skin se calcula consultando `skin_prices` (USD). Si la skin no posee cotización activa en caché, se utiliza el valor esperado de su rareza según el modelo de `lib/case-roi.ts` (`legendary`: $80.00, `epic`: $15.00, `rare`: $2.00, `common`: $0.50).
* **Desempate (Tie):** Cuando el valor de ambos drops es exactamente idéntico:
  - *Regla adoptada:* Cada contendiente conserva su ítem respectivo. El jugador recibe su propia skin (1 skin acreditada) y no se realiza robo de ítems. Esto garantiza una compuerta predecible, justa y verificable en tests.

### Trade-Off 3: Catálogo de Bots Simulados
Se preconfigura una cuadrilla de 5 bots temáticos con personalidades y avatares nativos (emojis/CSS, sin requests de red externas):
1. `bot-gaben`: Lord Gaben (El Patriarca del Drop) - Avatar: 👑
2. `bot-clucky`: Clucky (Pollo de Inferno) - Avatar: 🐔
3. `bot-neo`: Neo-Sniper (El Francotirador) - Avatar: 🎯
4. `bot-jarvis`: Jarvis AI (Algoritmo Cuántico) - Avatar: 🤖
5. `bot-boris`: Boris Rush-B (Veterano de Mirage) - Avatar: ⚡

---

## 3. Arquitectura del Modelo de Datos

### DDL SQLite (`lib/db.ts`)
```sql
CREATE TABLE IF NOT EXISTS case_battles (
  id TEXT PRIMARY KEY,
  chest_id TEXT NOT NULL REFERENCES rewards(id),
  chest_name TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  player_item_id TEXT NOT NULL,
  player_item_name TEXT NOT NULL,
  player_item_rarity TEXT,
  player_item_image TEXT,
  player_item_value REAL NOT NULL,
  bot_item_id TEXT NOT NULL,
  bot_item_name TEXT NOT NULL,
  bot_item_rarity TEXT,
  bot_item_image TEXT,
  bot_item_value REAL NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('player', 'bot', 'tie')),
  xp_spent INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_case_battles_created_at ON case_battles(created_at DESC);
```

---

## 4. Diseño del Flujo de Ejecución Transaccional (`lib/case-battle.ts`)

```
[Cliente: Solicita Batalla]
          │
          ▼ POST /api/case-battle { chestId, botId?, operationId? }
┌─────────────────────────────────────────────────────────────────┐
│ Transacción SQLite Atómica:                                     │
│ 1. Chequeo de Idempotencia (operationId en case_battles)         │
│ 2. Validación de saldo: balance >= totalCost (chest + key)      │
│ 3. Débito atómico de XP: incrementXpBalance(db, -totalCost)     │
│ 4. Sorteo dual independiente: pickChestItem(pool) x 2           │
│ 5. Cálculo de valores (skin_prices / tier fallback)             │
│ 6. Determinación de ganador: player | bot | tie                │
│ 7. Impacto en redemptions (0, 1 o 2 ítems según resultado)      │
│ 8. Registro en tabla case_battles                               │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼ 200 OK con resultado del duelo
[Cliente: Animación dual de carretes sincronizados]
          │
          ▼ Revelación y feedback háptico/audio
```

---

## 5. Diseño de Componentes UI y Audio

1. **`lib/sound.ts`:**
   - `playBattleVictory()`: Acorde mayor triunfal ascendente en Web Audio API (C5 -> E5 -> G5 -> C6).
   - `playBattleDefeat()`: Glissando descendente disonante de sierra filtrada (220Hz -> 75Hz) con decaimiento suave.
2. **`components/CaseBattleModal.tsx`:**
   - Selector de bot rival o elección automática aleatoria.
   - Dos carretes paralelos sincronizados (`buildReel` de `lib/chest-reel.ts`), con indicador central de aterrizaje.
   - Botón de "Saltar animación" y respeto inmediato a `prefers-reduced-motion`.
   - Cartel de veredicto con desglose de valores y badge de victoria/derrota/empate.
3. **Punto de Entrada en `app/rewards/page.tsx`:**
   - Pestaña o botón de acción destacado: *"Case Battles 1v1"*.

---

## 6. Compuertas de Aceptación (Acceptance Gates)
* **G10 (Case Battle Determinism & Integrity):** 
  - Saldo insuficiente aborta sin debitar XP.
  - Victoria de jugador acredita exactamente 2 skins en `listInventory`.
  - Victoria de bot acredita 0 skins en `listInventory`.
  - Empate acredita exactamente 1 skin en `listInventory`.
  - Idempotencia probada ante reenvío de `operationId`.
* **G11 (Dual Reel Motion & Sound):** 
  - Bypass de 0ms verificado en reduced motion.
  - Cero errores de rAF o memory leaks en unmount.
