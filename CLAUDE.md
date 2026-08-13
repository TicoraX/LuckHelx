# CLAUDE.md

Sistema de Recompensas: convierte tareas reales en XP y lo gasta en una tienda y en cofres
con las cajas reales de CS2. App de escritorio local (Electron + Next.js + SQLite), un solo
usuario, sin cuentas ni backend en la nube.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run electron:dev` | La app de escritorio en desarrollo |
| `npm run dev` | Solo Next.js, base en `.local/data.db` |
| `npm test` | Vitest. Deben ser **12 archivos**; si ves 24, `exclude` de `vitest.config.ts` se rompió |
| `npm run build` | Build de producción |
| `node csgo/seed-to-db.js` | Reconcilia el catálogo CS2 contra el preset. Importa `lib/db.ts` directo, así que necesita Node ≥ 22.18, que despoja tipos sin flag. En Node más viejo, `--experimental-strip-types` |

## Lo que no se deduce leyendo el código

**La app empaquetada arranca sin catálogo.** `electron/main.js` apunta `DB_PATH` a
`app.getPath('userData')/data.db` y nada en el build siembra las 477 cajas. La única base
con catálogo es la de desarrollo. Al planear un arreglo de datos, no asumas que hay una
base de producción que migrar.

**Sembrar no arregla datos viejos por sí solo.** `seed-to-db.js` hace UPSERT justamente
porque antes solo insertaba: regenerar el preset no cambiaba una sola fila, y las cajas se
quedaban con el costo que tuvieran el día que se sembraron.

**`CREATE TABLE IF NOT EXISTS` no toca tablas que ya existen.** Una columna nueva necesita
`ALTER TABLE`; un `CHECK` nuevo necesita reconstruir la tabla entera, porque SQLite no
permite alterarlo. Las dos cosas ya pasaron acá: las bases viejas rechazaban la rareza
`legendary` y por eso el catálogo entero quedó sin un solo cuchillo.

**El árbol de trabajo suele estar sucio.** Antes de medir el comportamiento de un archivo,
corré `git diff` sobre ese archivo. Medir un experimento sin commitear y reportarlo como
comportamiento del proyecto ya mandó un plan entero en la dirección equivocada.

## Reglas

**Las migraciones de esquema van en `initSchema` (`lib/db.ts`)**, el único punto que toda
entrada llama. Idempotentes: detectar el estado y actuar, nunca asumir.

**Las migraciones de catálogo van en `csgo/seed-to-db.js`**, no en `initSchema`. El preset
pesa 7,6 MB y `csgo/` no se copia al paquete de Electron; leerlo al arrancar correría en
cada sesión y fallaría en el `.exe`.

**El historial no se reescribe.** `redemptions` guarda copia del nombre de la recompensa y
del objeto ganado en vez de resolverlos por JOIN, así que renombrar o borrar una recompensa
hoy no cambia lo que dice un movimiento de hace tres meses. Cualquier tabla histórica nueva
sigue la misma regla.

**Las probabilidades de los cofres son por tier, no por objeto** (`lib/rewards.ts`).
Ponderar objeto por objeto hacía que la rareza dependiera de cuántas variantes trajera cada
caja: con 65 cuchillos y 3 skins comunes, el tier más raro salía más de la mitad de las
veces. El rare-special está en 1,5%, no en el 0,26% real de CS2, que con un solo usuario
pone el primer cuchillo a 15 meses de distancia.

**Los señuelos del carrete se sortean con la misma distribución que el premio**
(`lib/chest-reel.ts`). Tomarlos uniformes del pool convertía la tira en una pared de
estrellas doradas idénticas.

**El premio no se nombra antes de tiempo.** `/api/redeem` devuelve `chestName` aparte de
`redeemed` para que el encabezado anuncie la caja, no lo que salió.

## Desviaciones deliberadas de las reglas globales

**Sin rate limiting ni headers de seguridad.** Es Electron local monousuario: no hay
superficie de red expuesta, ni sesiones, ni datos de terceros. La validación estricta de
inputs en las rutas API sí se mantiene. La clave de DeepSeek vive en SQLite y
`GET /api/settings` solo informa si existe.

**El audio de apertura no está versionado.** `public/sounds/*.mp3` está en `.gitignore`:
es una grabación del juego de Valve y este repo es público. El archivo vive local, el build
de Electron lo empaqueta igual porque copia `public/`, y si falta el carrete usa los ticks
sintetizados de `lib/sound.ts`.

## Documentación

`docs/superpowers/specs/` es la fuente de verdad del diseño vigente. **Leelas antes de
planificar**: el README solo las resume, y trabajar desde el resumen ya llevó a
reimplementar cosas que una spec había diferido a propósito.

`docs/superpowers/plans/` está en `.gitignore`: son artefactos de sesión, no documentación.
Si una decisión de un plan tiene que sobrevivir, va a una spec o a este archivo.

## Sin dependencias nuevas

El proyecto no tiene zod, ni un framework de migraciones, ni jsdom, ni React Testing
Library. Las rutas API validan a mano, las migraciones son SQL explícito, y los tests son
Vitest sobre lógica pura. Agregar cualquiera de esas cosas es una decisión de alcance, no
un detalle de implementación.
