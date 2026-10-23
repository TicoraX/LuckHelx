# GATES-supabase: migracion de LuckHelx a Supabase

> Disciplina `/unlazy`. Cada compuerta tiene un `CHECK` ejecutable y un `EXPECT` literal.
> Contexto y hallazgos: `HELX_AUDIT.md`. Ninguna compuerta se marca sin pegar su salida.
> Estado al 2026-10-22: G1 y G3 en verde.

---

### [ ] G0: Hipotesis escrita

- **Objetivo**: una spec que diga por que se revierte la decision del 2026-07-19 y cual de las tres respuestas de `HELX_AUDIT.md` seccion 0 aplica (multidispositivo, multiusuario aislado o multiusuario compartido).
- **CHECK**:
  ```bash
  grep -l "2026-07-19" docs/superpowers/specs/*supabase*.md && grep -c "S0" docs/superpowers/specs/*supabase*.md
  ```
- **EXPECT**: la ruta de la spec y un conteo `>= 1` (la spec trata el problema de las tareas autodeclaradas).

### [x] G1: Arreglos que valen en escritorio y en web

- **Objetivo**: S1 (semilla del upgrade), S2 (fallback de DeepSeek), S4 (odds), U1 (contraste), U2 (dialogos), U3 (44px).
- **CHECK**:
  ```bash
  grep -c "SELECT \* FROM upgrades" lib/upgrade.ts ; \
  grep -c "clampXpUnits(NaN)" lib/deepseek.ts ; \
  grep -rc 'className="modal-backdrop"' components app --include=*.tsx | grep -vc ":0$" ; \
  npx vitest run 2>&1 | grep -E "Test Files"
  ```
- **EXPECT**:
  ```text
  0
  0
  0
  Test Files  30 passed (30)
  ```
  Mas: contraste del texto renderizado `>= 4.5` en los dos temas.
- **Evidencia (2026-10-22)**: `0`, `0`, `0` y `Test Files  30 passed (30)` (256 tests). Sonda de
  contraste en 30 vistas (5 paginas, 360/390/768, oscuro y claro): 774 textos bajo 4.5:1
  antes, 0 despues; 63 exentos (filas de carga a opacidad 0.35 y botones deshabilitados).
  Commits: `1f75bf7` (S1), `9c43511` (S2), `a97c47f` (S4), `e545c77` (contraste),
  `23f60f8` (modales sobre `<dialog>`), `eb7871e` (44 px y vista movil).

### [ ] G2: Escritorio congelado

- **Objetivo**: el arbol sucio commiteado y un tag que reconstruye el `.exe` actual.
- **CHECK**:
  ```bash
  git status --short | wc -l && git describe --tags --exact-match
  ```
- **EXPECT**: `0` y un tag `v0.3.x`.

### [x] G3: Blueprint SQL verde

- **CHECK**:
  ```bash
  cd docs/supabase-blueprint && npm ci && npm run verify | tail -1
  ```
- **EXPECT**:
  ```text
  ALL_GATES_PASS
  ```
- **Evidencia (2026-10-19)**: 13 PASS, `ALL_GATES_PASS`. Distribucion en 20.000 tiradas: legendary 1.40, epic 4.01, rare 15.69, common 78.90.

### [ ] G4: Staging aplicado y sin advertencias de seguridad

- **CHECK**:
  ```bash
  grep -q "function public.complete_task" docs/supabase-blueprint/0001_init.sql && \
  cp docs/supabase-blueprint/0001_init.sql supabase/migrations/20261101000000_init.sql && \
  supabase db push --linked && supabase db lint --linked --level error
  ```
  Mas, en el SQL editor de staging:
  ```sql
  select relname from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
  ```
- **EXPECT**: lint sin errores, la consulta devuelve 0 filas y el Security Advisor del dashboard muestra 0 errores.

### [ ] G5: Catalogo sembrado

- **CHECK** (conexion directa `:5432`):
  ```sql
  select (select count(*) from cs2_chests), (select count(*) from cs2_skins where rarity = 'legendary') > 0;
  ```
- **EXPECT**: `477 | t`.

### [ ] G6: V0.1 end-to-end

- **Objetivo**: login, completar tarea, abrir caja con el carrete actual consumiendo `open_chest`, vender con `sell_item`.
- **CHECK**: captura de cada paso con `/screenshot` o `/webwright` y la respuesta JSON de `open_chest` con `fairness.server_seed_hash` presente y sin `server_seed`.
- **EXPECT**: 4 capturas y el JSON pegados aca.

### [ ] G7: Concurrencia real

- **Objetivo**: probar el `FOR UPDATE` contra conexiones que compiten de verdad (PGlite no puede).
- **CHECK**: usuario de prueba con saldo exacto para 10 aperturas; 50 llamadas `supabase.rpc('open_chest', ...).throwOnError()` en paralelo con `Promise.allSettled`. Sin `throwOnError()`, supabase-js resuelve con `{ error }` en vez de rechazar y las 50 cuentan como `fulfilled`.
- **EXPECT**: exactamente 10 `fulfilled`, 40 `rejected` con `XP insuficiente`, saldo final `0`, 10 filas nuevas en `redemptions`.

### [ ] G8: Importacion del escritorio

- **CHECK**: `exportBackup` del escritorio, RPC de importacion en staging, y comparar.
- **EXPECT**: mismo `xp_balance`, misma cantidad de `redemptions` y mismo inventario (canjes menos ventas) que el respaldo.
