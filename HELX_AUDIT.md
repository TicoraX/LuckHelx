# HELX_AUDIT: LuckHelx, auditoria y migracion a Supabase

> Flujo: `/helx` -> Pilar 0 `/reality-check`. Fecha: 2026-10-19.
> Base medida: arbol de trabajo de `main` con 81 archivos modificados y 9 sin trackear sobre `18d6cd3`.
> Cada hallazgo indica si existe en `HEAD` o solo en el arbol sucio.
> Evidencia ejecutada: `npx vitest run` (30 archivos, 253 tests en verde; CLAUDE.md dice 237, la diferencia son `lib/sound.test.ts` y `lib/upgrade.test.ts` sin trackear), contraste WCAG calculado con Python y el blueprint SQL corrido contra Postgres real (PGlite 0.5.8 con pgcrypto): `docs/supabase-blueprint/verify.mjs`, 13 checks, `ALL_GATES_PASS`.

---

## 0. Reality check

### Veredicto

- **Estado**: SOBREDISENADA. Requiere poda.
- **Mayor riesgo**: revertir una decision documentada sin una hipotesis nueva. El proyecto **ya estuvo en Supabase** y salio el 2026-07-19 (`570b826 chore: remove Supabase, auth, and PWA-manifest leftovers`; spec `docs/superpowers/specs/2026-07-19-electron-local-migration-design.md`). La spec atribuye a Supabase "la mayor parte de la friccion del proyecto": OAuth, manejo de la service-role key y un entorno de desarrollo sin acceso a `*.supabase.co`. Volver sin escribir que cambio repite el ciclo.
- **Pregunta sin respuesta que bloquea todo**: para que sirve la nube. Hay tres respuestas posibles y cada una pide un plan distinto:
  1. *Usarla desde el celular* (un usuario, varios dispositivos): basta con auth + RLS + las RPCs de dinero. El resto del modulo 2 es defensa contra uno mismo.
  2. *Varios usuarios sin interaccion entre ellos*: igual que (1), mas cuotas de DeepSeek por usuario.
  3. *Varios usuarios que comparten algo* (ranking, batallas PvP, intercambio): ahi la economia pasa a ser superficie de ataque real, y el problema de fondo no es tecnico (ver S0).
- **Apetito**: paridad completa de las 26 rutas API y los 15 stores sincronos de `better-sqlite3` = 3 a 5 semanas. Corte V0.1 de abajo = 5 a 7 dias.

### S0. El problema que ninguna RPC arregla

El XP nace de tareas que el propio usuario declara completadas (`lib/tasks-store.ts:138-157`). DeepSeek tasa, pero no verifica que la tarea exista. En local eso es un sistema de honor y esta bien. En multiusuario, cualquier cuenta imprime XP creando tareas: el techo lo pone `MAX_XP_UNITS` (`lib/xp.ts:27`, 100 XP por tarea) por la cantidad de tareas que uno quiera crear. Bloquear saldos con `FOR UPDATE` protege un numero que el usuario puede inflar por la puerta de adelante. Mitigacion real: tope diario de XP por tareas dentro de la RPC (`app_config.task_daily_cap_units`, sembrado en el blueprint) y nada compartido entre usuarios hasta resolver esto.

### Prior art (build vs buy)

| Opcion | Que resuelve | Veredicto |
|---|---|---|
| Quedarse en Electron + `lib/backup.ts` | Respaldo y traslado manual entre maquinas; ya existe (`exportBackup`/`restoreBackup`) | Correcto si la respuesta es "nada de lo anterior" |
| Supabase (Postgres + Auth + RLS) | Auth delegada, RLS, RPCs atomicas | ADOPTAR si la respuesta es (1), (2) o (3). Es "buy": no construir auth propia |
| Turso / libSQL | Mismo dialecto SQLite, conserva el esquema | Descartado: igual hay que agregar auth y aislar por usuario, y el cliente es asincrono, asi que el refactor de los 15 stores es el mismo |
| ElectricSQL / PowerSync | Sync local-first contra Postgres | Cementerio: sync bidireccional para un usuario es la trampa del tiempo real |

### Poda (corte de alcance)

**Cementerio (fuera del plan)**
- Lenis: el propio WF01 (`01_design_and_motion.md:74-75`) lo reserva para scrollytelling. Esto es un dashboard: rama "Presupuesto ligero".
- Micro-cache Single-Flight en RAM (WF05 capa 2): la unica lectura caliente es el catalogo, que es publico y estatico. `unstable_cache` con tag o datos estaticos alcanzan.
- Pooler 6543 + `prepare: false` como requisito: solo aplica a un driver Postgres directo (postgres.js, Drizzle). El blueprint usa `supabase-js` + RPC, que va por PostgREST y no abre conexiones propias. Ver M3.4.
- Capa de abstraccion "driver SQLite o Postgres" para mantener las dos versiones vivas en el mismo codigo: una interfaz con dos implementaciones que nadie pidio. El escritorio queda congelado en su release (ver M4.2).

**Purgatorio (despues de V0.1 en produccion)**
- Case battles, upgrade, trade-up, quests, daily spin, premier rating, colecciones, pomodoro, CSV, heatmap.
- Precios en vivo de Steam: `steamcommunity.com/market/priceoverview` limita por IP; con N usuarios desde un mismo servidor el 429 llega rapido. En V0.1 los precios salen de `cs2_prices` sembrada.

**Nucleo V0.1**
- Entidades: `profiles`, `tasks`, `redemptions`, `item_sales` + catalogo de solo lectura.
- Loop: completar tarea -> abrir caja (`open_chest`) -> carrete -> vender (`sell_item`).
- Limites: auth por magic link o OAuth de Supabase sin pantallas propias, 4 RPCs (`open_chest`, `sell_item`, `rotate_seed` y `complete_task`), sin realtime.

---

## Modulo 1. UI/UX, fisicas y accesibilidad (WF01)

| # | Severidad | Hallazgo | Evidencia | Arreglo minimo |
|---|---|---|---|---|
| U1 | FAIL | `--text-dim` no llega a 4.5:1 y se usa en texto de 0.8rem | Calculado: 3.38:1 sobre `--bg` y 3.20:1 sobre `--bg-card` (oscuro); 2.78:1 y 3.07:1 (claro). Usos: `app/globals.css:752,994,1554`, `components/SettingsModal.tsx:512`, `app/inventory/page.tsx:538`, `app/ledger/page.tsx:209`, `components/ActivityHeatmap.tsx:100`, `components/SkinDetailModal.tsx:190` | Subir `--text-dim` hasta >= 4.5:1 en ambos temas o usar `--text-muted` (5.3 a 5.6 en oscuro, 4.95 en claro, ya pasa) |
| U2 | FAIL | 7 de 9 modales sin semantica de dialogo, sin Escape y sin manejo de foco | `role="dialog"`/`aria-modal` y Escape solo en `CaseBattleModal.tsx` y `SettingsModal.tsx`. Sin ellos: `AchievementsModal.tsx:76`, `BatchOpeningModal.tsx:31`, `CollectionsModal.tsx:48`, `ConfirmModal.tsx:25`, `DailySpinModal.tsx:65`, `HelpModal.tsx:15`, `PomodoroWidget.tsx:231` | `<dialog>` nativo con `showModal()`: da foco atrapado, Escape, `::backdrop` y retorno de foco sin JS propio |
| U3 | FAIL | Area tactil de 36px | `.theme-toggle` en `app/globals.css:268-269`: `2.25rem` | `min-width/min-height: 44px` |
| U4 | WARN | Estados de carga sin retardo de gracia de 150ms | Filas fantasma con `&mdash;` renderizadas en el primer frame: `app/page.tsx:507`, `app/inventory/page.tsx:544` (opacidad inline 0.35), `app/rewards/page.tsx:734,955,1154`. En local la API responde en milisegundos, asi que el usuario ve un destello. Ademas la cantidad fija de filas (3, 6, 2) difiere del resultado real: hay salto de altura. CLS no medido | `animation: fadeIn .2s ease-out 150ms both` en `.ghost` y reservar alto con `min-height` del contenedor |
| U5 | WARN | `.skeleton` es CSS muerto | Definido en `app/globals.css:1559-1564`, 0 usos en `app/` y `components/` | Borrarlo o usarlo en U4, no los dos estilos |
| U6 | WARN (solo web) | `100vh` | `app/globals.css:95` (`body`), `app/not-found.tsx:7`, `components/Confetti.tsx:83` | `100svh` en los dos primeros; el confeti es `position: fixed`, usar `inset: 0`. En Electron `100vh` es correcto: esto solo importa si V0.1 sale a movil |
| U7 | PASS | Reduced motion resuelve la ruleta a 0ms | `components/ChestReel.tsx:82-95`: con `prefers-reduced-motion` fija el offset final, marca `landed` y llama `onDone` sin animar. Bloque global con `animation-iteration-count: 1 !important` en `app/globals.css:1674-1682`. Mismo chequeo en `CaseBattleModal.tsx:157` y `app/rewards/page.tsx:303` | Nada |
| U8 | PASS | El carrete no decide el premio | `buildReel` (`lib/chest-reel.ts:28-52`) recibe `winnerId` del servidor; los senuelos usan la misma distribucion por tier | Nada |

---

## Modulo 2. Seguridad y resiliencia economica (WF03)

| # | Severidad | En HEAD | Hallazgo | Evidencia |
|---|---|---|---|---|
| S1 | CRITICO (web) / ALTO (local) | No, `lib/upgrade.ts` sin trackear | La semilla activa del upgrade se filtra y nunca se revela | Cada fila de `upgrades` guarda `server_seed` en claro (`lib/db.ts:196`). `GET /api/upgrade` devuelve `history` con `SELECT *` (`lib/upgrade.ts:486-489`, `app/api/upgrade/route.ts:14`) mientras esa semilla sigue activa: quien lee el historial calcula la proxima tirada. No hay rotacion: `revealed` no aparece en `lib/upgrade.ts` |
| S2 | ALTO | Si | Fallback inventado en una ruta que acredita XP | Si DeepSeek falla, `fallback()` devuelve `clampXpUnits(NaN)` = 5 XP (`lib/deepseek.ts:10-11,50,57,67,70`). La tarea se inserta con ese valor (`app/api/tasks/create/route.ts:81-96`) y `completeTask` la acredita sin mirar el motivo (`lib/tasks-store.ts:138-157`). `lib/sync.ts:17` solo evita cachearla. Viola fail-fast: debe ser 502 sin tarea creada |
| S3 | CRITICO (web) / por diseno (local) | Si | Las perillas economicas son escribibles por el cliente | `PATCH /api/rewards/[id]` cambia `xp_cost` de cualquier caja CS2 (`app/api/rewards/[id]/route.ts:17-26`); `POST /api/settings` acepta `keyCostXpUnits = 0` (`lib/settings-store.ts:156-158` permite `>= 0`). Caja a 1 unidad + llave a 0 + venta a precio de mercado = impresora de XP. En multiusuario el catalogo es compartido: cualquiera reprecia para todos |
| S4 | MEDIO | Si | Probabilidades reales distintas de las documentadas | `TIER_ODDS` suma 101.24 (`lib/rewards.ts:90-95`) y se renormaliza: legendario real 1.48%, comun 78.94%. Medido en 20.000 tiradas contra el blueprint. CLAUDE.md dice "1,5%". Ajustar `common` a 78.68 si el 1.5 es el objetivo |
| S5 | MEDIO (dev) | Si | CSRF contra la API local | Las rutas parsean `request.json()` sin exigir `Content-Type: application/json`; una pagina cualquiera puede mandar `text/plain` a `127.0.0.1`. En produccion el puerto es aleatorio (`electron/main.js:17`, `listen(0)`), lo que lo mitiga; en `npm run dev` es 3000 fijo y `POST /api/backup` sobrescribe la base |
| S6 | BAJO | Si | Montos en `REAL` | `item_sales.unit_usd` (`lib/db.ts:102`), `case_battles.*_value` (`:153,:158`). En Postgres van a `bigint` en centavos |
| S7 | BAJO | Si | Dia del giro diario en UTC | `lib/daily-spin.ts:20,40`. En UTC-5 el dia cambia a las 19:00 locales |
| S8 | BAJO | Si | Los "burns" del trade-up se escriben como ventas | `lib/trade-up.ts:96-103` inserta en `item_sales` con `unit_usd = 0` y nombre `[Trade-Up] ...`; ensucia el historial de ventas. El blueprint lo separa con `item_sales.reason` |

**Lo que esta bien (verificado en codigo):**
- Consistencia de saldo: `incrementXpBalance` (`lib/settings-store.ts:21-47`) aplica la guarda en el mismo `UPDATE ... WHERE ... >= 0` y lanza si `changes === 0`. Todas las mutaciones de saldo corren dentro de `db.transaction` (`rewards-store.ts:223,285`, `batch-open.ts:61`, `case-battle.ts:211`, `daily-spin.ts:69`, `quests.ts:143`, `tasks-store.ts:139`, `upgrade.ts:303`). Con `better-sqlite3` sincrono y una sola conexion, eso serializa. El punto debil es de tipo: el saldo vive como `TEXT` en `meta` sin `CHECK`.
- Doble venta: el chequeo de stock y el `INSERT` van en la misma transaccion (`rewards-store.ts:223-256`).
- Reintentos: case battle, trade-up y batch-redeem usan `operationId` como clave primaria; un replay choca con la PK y se rechaza.
- Inmutabilidad: `redemptions` copia nombre, rareza e imagen (`lib/db.ts:261-267`, `rewards-store.ts:288-301`); `item_sales` y `case_battles` tambien. Unica excepcion conocida y documentada: el backfill de filas viejas por JOIN (`lib/db.ts:358-362`).
- Inyeccion de probabilidades: el premio se sortea en el servidor (`app/api/redeem/route.ts:46`). `executeCaseBattle` acepta `overridePlayerItem` y `rand`, pero la ruta no los recibe del cuerpo (`app/api/case-battle/route.ts:23`).
- `catch {}` vacios: solo en `lib/sound.ts` (7), sobre audio. No tocan datos.

---

## Modulo 3. Blueprint Supabase (PostgreSQL + RLS)

Archivos: `docs/supabase-blueprint/0001_init.sql` (DDL, RLS, `open_chest`, `sell_item`, `rotate_seed`) y `verify.mjs` (13 checks). No esta en `supabase/migrations/` a proposito: es un blueprint validado, no una migracion activa.

### 3.1 Esquema

- `profiles`: `xp_balance bigint not null default 0 check (xp_balance >= 0)`, FK a `auth.users` con `on delete cascade`, creado por trigger `on_auth_user_created`.
- Catalogo compartido: `cs2_chests`, `cs2_skins` (`rarity` es enum `not null`, lo que elimina el parche `tierOf` de `lib/rewards.ts:101-103`), `cs2_chest_contents`, `cs2_prices` (`usd_cents bigint`), `app_config` (llave y tope diario).
- Usuario: `tasks`, `redemptions`, `item_sales`, `trade_ups`, `daily_spins` (`unique (user_id, spin_date)`), `quest_claims` (`unique (user_id, quest_id, claimed_date)`), `case_battles`. Todas con `user_id uuid not null references auth.users(id)`.
- Cambio de modelo: `item_sales.redemption_id uuid unique`. Cada venta consume una fila concreta de `redemptions`. La doble venta pasa a ser un `23505` de Postgres en vez de un `COUNT - COUNT` (`lib/rewards-store.ts:237-243`).
- `private.pf_seeds`: fuera del esquema expuesto por PostgREST. Un indice unico parcial garantiza una semilla activa por usuario.

### 3.2 RLS

- Catalogo: `for select to anon, authenticated using (true)`; `revoke insert, update, delete` a `anon` y `authenticated`. Solo `service_role` escribe.
- Usuario: una politica `for select to authenticated using (user_id = (select auth.uid()))` (el `select` envuelto evalua `auth.uid()` una vez por consulta, no por fila). **Sin politicas de INSERT/UPDATE/DELETE**, mas `revoke` explicito: Supabase da `GRANT ALL` sobre `public` a `anon` y `authenticated` por defecto, y el arnes lo reproduce para probar que los revoke funcionan.

### 3.3 `open_chest`

Correcciones al brief, las tres criticas:

1. **No recibe `user_id`.** Una funcion `SECURITY DEFINER` con `p_user_id` deja abrir cajas con el saldo de cualquiera: es un IDOR con permisos de owner. El usuario sale de `auth.uid()`.
2. **No usa `random()`.** No es criptografico. Commit-reveal: `HMAC-SHA256(server_seed, client_seed:nonce)`, bytes 0-3 eligen el tier y 4-7 el objeto, igual que `generateProvablyFairRoll` (`lib/upgrade.ts:164-180`).
3. **No devuelve la semilla.** Devuelve `server_seed_hash`, `client_seed`, `nonce` y `hmac`. La semilla se revela con `rotate_seed()`, que la cierra y abre otra. Devolverla con cada tirada, como pide el brief, permite predecir la siguiente: es S1 trasladado a Postgres.

Flujo: `auth.uid()` -> caja -> `costo + key_cost_units` -> `SELECT xp_balance ... FOR UPDATE` -> validar -> descontar -> semilla `FOR UPDATE` y `nonce + 1` -> HMAC -> tier por odds renormalizadas sobre los tiers presentes (`order by rarity`, el orden del enum) -> objeto por `order by s.id offset floor(r2 * n)` -> `INSERT redemptions` con snapshot y `pf_seed_id`/`pf_nonce` -> `jsonb`. `search_path = ''` y nombres calificados. `EXECUTE` revocado a `public` y `anon`, concedido a `authenticated`.

Para que un cliente verifique, `pickChestItem` en TS tiene que iterar los tiers en orden de enum y los objetos por id. Hoy itera en orden de aparicion en el pool (`lib/rewards.ts:111-127`): la distribucion es la misma, pero la tirada concreta no se puede reproducir.

Resultado de `verify.mjs`:

```
PASS open_chest descuenta 274 unidades
PASS open_chest no devuelve server_seed
PASS INSERT directo en redemptions rechazado
PASS UPDATE directo de saldo rechazado
PASS UPDATE de precio de caja rechazado
PASS semillas privadas ilegibles
PASS U2 no ve perfil ni historial de U1
PASS saldo 0 no abre
PASS anon no ejecuta open_chest
PASS U2 no vende objetos de U1 (IDOR)
PASS segunda venta de la misma unidad rechazada
distribucion % { legendary: 1.40, rare: 15.69, common: 78.90, epic: 4.01 }
PASS distribucion por tier dentro de tolerancia (4 sigma sobre odds renormalizadas)
PASS hash comprometido y HMAC verificables desde Node
ALL_GATES_PASS
```

**Lo que el arnes NO prueba:** concurrencia real. PGlite es de una sola conexion, asi que el `FOR UPDATE` se ejercita pero no compite. Eso queda como compuerta de staging (G7).

### 3.4 Conexion

- App (Next.js en Vercel o similar): `@supabase/ssr` + `supabase.rpc('open_chest', { p_chest_id })` con el JWT del usuario. Va por HTTPS a PostgREST; no hay puerto, pooler ni prepared statements que configurar.
- Solo si un proceso usa SQL directo (siembra del catalogo, scripts):
  - Migraciones y la siembra de 477 cajas: conexion directa o pooler en modo sesion, `:5432`.
  - SQL directo desde funciones serverless: pooler en modo transaccion, `:6543`, y en postgres.js `postgres(url, { prepare: false })`. El modo transaccion reasigna la conexion en cada transaccion y rompe los prepared statements con nombre.
- Cookies `__Host-` (WF03): `@supabase/ssr` nombra la cookie `sb-<ref>-auth-token`. El prefijo exige `Secure`, `Path=/` y nada de `Domain`. Verificar que `cookieOptions` acepte el nombre en la version que se instale; no lo probe.
- `service_role`: solo en la siembra del catalogo y en `POST /api/tasks/create`, que llama a DeepSeek y escribe `xp_units`. Es la unica excepcion a WF03 y existe por S0: PL/pgSQL no puede llamar HTTP de forma sincrona, y si el cliente pudiera insertar `xp_units` elegiria el maximo. La ruta valida al usuario con `auth.getUser()` antes de usar la clave. El tope diario va en `complete_task(p_task_id uuid)`, la RPC que acredita la tarea: `SECURITY DEFINER`, usuario desde `auth.uid()`, bloquea el perfil `FOR UPDATE`, suma lo acreditado hoy en `tasks` y rechaza si supera `app_config.task_daily_cap_units`. El blueprint todavia no la incluye: se escribe y se prueba en `verify.mjs` antes de G4.
- DeepSeek: hoy la clave es del usuario y vive en `meta` (`lib/settings-store.ts:49-55`). En web, guardar claves de terceros por usuario es un secreto mas que custodiar. Conviene una clave del servidor con cuota diaria por usuario, como tenia la version Supabase original (`deepseek_calls_today`).

---

## Modulo 4. Tests y paso a paso

### 4.1 Tests

La premisa "237 tests sin SQLite" no se cumple hoy. De 30 archivos, 15 importan `createTestDb`/`getDb`. Por conteo de `it(` / `test(` son unos 174 de los 253 tests:

| Archivos | Tests aprox. | Destino |
|---|---|---|
| `rewards-store` (34), `skin-prices` (27), `ranks` (20), `db` (18), `upgrade` (13), `tasks-store` (13), `settings-store` (12), `backup` (10), `case-battle` (9), `trade-up`, `quests`, `batch-open` (4 c/u), `sync` (3), `collections` (2), `daily-spin` (1) | ~174 | Siguen probando el escritorio sin cambios. La logica de dinero equivalente se prueba en SQL con el patron de `verify.mjs` |
| `xp`, `rewards`, `chest-reel`, `achievements`, `analytics`, `case-pricing`, `csv-export`, `date`, `deepseek`, `drop-stats`, `guardrails`, `inventory-filter`, `pomodoro`, `sound`, `streak` | ~79 | Logica pura: se comparten tal cual entre escritorio y web |

Reglas:
1. No mockear Supabase en Vitest. Un mock de `supabase.rpc` prueba el mock, no el RLS ni el `FOR UPDATE`.
2. La logica de dinero vive en PL/pgSQL y se prueba en Postgres real: PGlite en Vitest (2 a 3 s, sin Docker) o `supabase test db` con pgTAP (necesita Docker, que hoy no corre en esta maquina). PGlite como devDependency de la app es una decision de alcance segun CLAUDE.md ("Sin dependencias nuevas"); por eso hoy vive en `docs/supabase-blueprint/package.json`, aislado.
3. Test de paridad TS/SQL: dados los mismos bytes HMAC, `pickChestItem` con tiers ordenados por enum y objetos por id elige lo mismo que `open_chest`. Es el unico test que ata las dos implementaciones.

### 4.2 Paso a paso

El escritorio no se interrumpe porque no se toca: se congela en un release y la web se desarrolla en `feat/supabase`. Sin capa de abstraccion de base de datos. Los datos del escritorio pasan a la nube con el JSON de `exportBackup` (`lib/backup.ts`) y una RPC de importacion de un solo uso.

Las compuertas ejecutables estan en `GATES-supabase.md`.

| Paso | Que | Compuerta |
|---|---|---|
| 0 | Escribir en una spec por que se vuelve a Supabase y cual de las tres respuestas aplica | G0 |
| 1 | Arreglar en el escritorio lo que vale en los dos mundos: S1, S2, S4, U1, U2, U3 | G1 |
| 2 | Commitear el arbol sucio (81 archivos) y cortar el tag del escritorio | G2 |
| 3 | Blueprint verde | G3 |
| 4 | Proyecto Supabase de staging, `supabase db push`, Security Advisor sin errores | G4 |
| 5 | Siembra del catalogo: variante de `csgo/seed-to-db.js` que emite SQL para `cs2_*`, cargada por `:5432` | G5 |
| 6 | V0.1: auth, `open_chest`, `sell_item`, `complete_task` con tope diario. El carrete existente consume la RPC | G6 |
| 7 | Concurrencia en staging: 50 aperturas paralelas con saldo para 10 | G7 |
| 8 | Importar un respaldo real del escritorio y comparar saldo e inventario | G8 |
