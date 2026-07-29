# Sistema de Recompensas

Convierte tus tareas diarias en experiencia (XP): una IA (DeepSeek) evalúa
la dificultad de cada tarea, y el XP acumulado se gasta en una tienda y en cofres
con premios que tú mismo defines.

App local de escritorio (Electron) — sin cuentas, sin backend en la nube. Todo
vive en un archivo SQLite en tu propia máquina.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend y rutas API
- **Electron** — empaqueta la app como programa de escritorio
- **better-sqlite3** — base de datos local (un solo archivo, un solo usuario)
- **DeepSeek API** — evaluación de XP por tarea (con tu propia clave)
- **Framer Motion** — animaciones puntuales (contador de XP, salida de tareas completadas)
- **Vitest** — tests de la lógica de negocio

## Setup

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Correr en modo escritorio (desarrollo)**
   ```bash
   npm run electron:dev
   ```
   Abre una ventana de Electron apuntando al servidor de desarrollo de Next.js.
   La base de datos se crea automáticamente (`app.getPath('userData')`, ej.
   `%APPDATA%/sistema-de-recompensas/data.db` en Windows).

3. **Configurar tu clave de DeepSeek** — al abrir la app, ve a **Ajustes** y
   pega tu clave de API de DeepSeek. Se guarda localmente en la base de datos,
   `GET /api/settings` solo informa si existe, y cuando se evalúan tareas se
   envía a `api.deepseek.com` en el header `Authorization`.

4. **Correr solo como app web (sin Electron)** — también funciona como página
   web normal si prefieres probarla en el navegador:
   ```bash
   npm run dev
   ```
   En este modo la base de datos se crea en `.local/data.db` dentro del proyecto.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (solo Next.js, sin Electron) |
| `npm run electron:dev` | App de escritorio en modo desarrollo |
| `npm run build` | Build de producción de Next.js |
| `npm run electron:build` | Empaqueta un `.exe` portable de Windows |
| `npm test` | Corre los tests (Vitest) |
| `node csgo/build-cases.js` | Regenera `csgo/cs2-cases-preset.json` desde el catálogo CS2: filtra cajas válidas, consulta precio real en Steam Market (cacheado en `csgo/case-prices.json`, ~20 req/min para no ser limitado) y calcula el costo en XP de cada caja. Tarda varios minutos por el límite de Steam; es seguro re-ejecutarlo, retoma donde quedó |
| `node csgo/seed-to-db.js` | Siembra el preset generado arriba en tu base de datos local (`chest`, `chest_item`, `chest_contents`). Idempotente — no duplica si ya sembraste antes |

## Cómo funciona

1. Al abrir la app entras directo al dashboard — no hay cuentas ni login.
2. Crea y completa tareas directamente en la app. Cada tarea nueva se evalúa con
   DeepSeek (usando tu clave configurada en Ajustes) para asignarle un valor de
   XP, con caché por descripción para no reevaluar tareas repetidas.
3. Al completar una tarea, se acredita el XP a tu balance.
4. En `/rewards` defines tu propio catálogo: recompensas de tienda (canje directo)
   y cofres (costo fijo por abrir, premio aleatorio ponderado por rareza entre
   los `chest_item` que definas).
5. El catálogo de cofres viene precargado con las cajas reales de CS2 (datos
   de [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API), vendorizados en
   `csgo/`): cada caja solo puede dar las skins que le corresponden de verdad
   (tabla `chest_contents`), su costo en XP sale del precio real de esa caja en
   el Mercado de la Comunidad de Steam (1 USD = 1 XP), y hay una probabilidad
   baja de que te toque un cuchillo/guante en vez de una skin normal. Algunas
   cajas no tienen precio en Steam (nunca se vendieron sueltas ahí, o Steam
   limita las consultas si se piden demasiado rápido) — esas usan un costo fijo
   de respaldo (50 XP) en vez de fallar. La pestaña "Cofres" en `/rewards` tiene
   buscador, rango de XP, filtro "con cuchillo/guante" y paginación.

## Diseño visual

La identidad visual es un "libro de cuentas de misiones": las tareas son
entradas de un ledger, el XP es una moneda que se contabiliza, las
recompensas son tickets sellados. Paleta de tinta cálida + verde musgo +
oro latón (sin terracota ni acentos neón), tipografía Roboto Slab para
títulos e IBM Plex Mono para todo valor numérico (XP, costos), esquinas
rectas (4-6px), y divisores punteados entre filas de tareas en vez de
tarjetas apiladas. Tokens definidos en `app/globals.css`.

La sección de cofres de CS2 (`/rewards`, pestaña "Cofres") es la única
excepción deliberada: usa colores de rareza reales del juego (azul/púrpura/
rosa/rojo/dorado) y un carrete de apertura estilo Steam sobre fondo oscuro,
en vez de la paleta musgo/latón — es una zona visual aparte a propósito,
no una migración pendiente.

## Seguridad

- Un solo usuario local: no hay cuentas, ni sesiones, ni datos de otras
  personas que proteger — la base de datos es un archivo en tu propio equipo.
- La clave de DeepSeek se guarda en SQLite local; `GET /api/settings` solo
  informa si hay una clave configurada (`{ hasDeepseekKey: boolean }`), nunca
  la devuelve.
- El canje de recompensas y el completado de tareas son atómicos a nivel de
  transacción (`db.transaction()` de better-sqlite3, con verificación de
  `xp_balance` dentro de la misma transacción), evitando doble gasto.

## Documentación de diseño

Las decisiones de arquitectura y diseño vigentes viven en `docs/superpowers/specs/`:
- `2026-07-19-electron-local-migration-design.md` — arquitectura actual (Electron + SQLite local, sin backend en la nube)
- `ledger-direction.md` — la identidad visual "libro de cuentas" y su estructura
- `2026-07-25-cs2-cases-expansion-design.md` — cofres con cajas reales de CS2, precio real por caja y pool propio por caja

Specs superadas (MVP con Supabase, rediseño de frontend previo, remoción de
Google Tasks) y los planes de implementación tarea por tarea no viven en el
repo — son artefactos de trabajo de una sesión, no documentación que deba
persistir. Siguen disponibles en el historial de git si hace falta
consultarlos.
