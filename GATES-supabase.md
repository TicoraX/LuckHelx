# GATES-supabase: migracion de LuckHelx a Supabase

> Disciplina `/unlazy`. Cada compuerta tiene un `CHECK` ejecutable y un `EXPECT` literal.
> Contexto y hallazgos: `HELX_AUDIT.md`. Ninguna compuerta se marca sin pegar su salida.
> Estado al 2026-10-19: solo G3 corrida y en verde.

---

### [ ] G0: Hipotesis escrita

- **Objetivo**: una spec que diga por que se revierte la decision del 2026-07-19 y cual de las tres respuestas de `HELX_AUDIT.md` seccion 0 aplica (multidispositivo, multiusuario aislado o multiusuario compartido).
- **CHECK**:
  ```bash
  grep -l "2026-07-19" docs/superpowers/specs/*supabase*.md && grep -c "S0" docs/superpowers/specs/*supabase*.md
  ```
- **EXPECT**: la ruta de la spec y un conteo `>= 1` (la spec trata el problema de las tareas autodeclaradas).

### [ ] G1: Arreglos que valen en escritorio y en web

- **Objetivo**: S1 (semilla del upgrade), S2 (fallback de DeepSeek), S4 (odds), U1 (contraste), U2 (dialogos), U3 (44px).
- **CHECK**:
  ```bash
  grep -c "SELECT \* FROM upgrades" lib/upgrade.ts ; \
  grep -c "clampXpUnits(NaN)" lib/deepseek.ts ; \
  grep -c "role=\"dialog\"\|<dialog" components/*Modal.tsx | grep -c ":0" ; \
  npx vitest run 2>&1 | grep -E "Test Files"
  ```
- **EXPECT**:
  ```text
  0
  0
  0
  Test Files  30 passed (30)
  ```
  Mas: `--text-dim` recalculado `>= 4.5` contra `--bg` y `--bg-card` en ambos temas, con la salida del script pegada aca.

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
- **CHECK**: usuario de prueba con saldo exacto para 10 aperturas; 50 llamadas `rpc('open_chest')` en paralelo con `Promise.allSettled`.
- **EXPECT**: exactamente 10 `fulfilled`, 40 `rejected` con `XP insuficiente`, saldo final `0`, 10 filas nuevas en `redemptions`.

### [ ] G8: Importacion del escritorio

- **CHECK**: `exportBackup` del escritorio, RPC de importacion en staging, y comparar.
- **EXPECT**: mismo `xp_balance`, misma cantidad de `redemptions` y mismo inventario (canjes menos ventas) que el respaldo.
