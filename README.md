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
   nunca se envía de vuelta al cliente ni sale de tu equipo.

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

## Cómo funciona

1. Al abrir la app entras directo al dashboard — no hay cuentas ni login.
2. Crea y completa tareas directamente en la app. Cada tarea nueva se evalúa con
   DeepSeek (usando tu clave configurada en Ajustes) para asignarle un valor de
   XP, con caché por descripción para no reevaluar tareas repetidas.
3. Al completar una tarea, se acredita el XP a tu balance.
4. En `/rewards` defines tu propio catálogo: recompensas de tienda (canje directo)
   y cofres (costo fijo por abrir, premio aleatorio ponderado por rareza entre
   los `chest_item` que definas).

## Diseño visual

La identidad visual es un "libro de cuentas de misiones": las tareas son
entradas de un ledger, el XP es una moneda que se contabiliza, las
recompensas son tickets sellados. Paleta de tinta cálida + verde musgo +
oro latón (sin terracota ni acentos neón), tipografía Roboto Slab para
títulos e IBM Plex Mono para todo valor numérico (XP, costos), esquinas
rectas (4-6px), y divisores punteados entre filas de tareas en vez de
tarjetas apiladas. Tokens definidos en `app/globals.css`.

`/rewards` todavía usa el lenguaje visual anterior (tarjetas) — la migración
a la hoja de ledger continua está pendiente a propósito, para hacerla una
sola vez sobre la versión final.

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

Los specs y planes de implementación completos viven en `docs/superpowers/`:
- `docs/superpowers/specs/` — decisiones de diseño (backend MVP, rediseño de frontend, migración a Electron/SQLite)
- `docs/superpowers/plans/` — planes de implementación tarea por tarea
