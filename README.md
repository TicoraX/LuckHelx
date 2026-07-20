# Sistema de Recompensas

Convierte tus tareas diarias en experiencia (XP): una IA (DeepSeek) evalúa
la dificultad de cada tarea, y el XP acumulado se gasta en una tienda y en cofres
con premios que tú mismo defines.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** — Postgres, Auth (Google OAuth), RLS
- **DeepSeek API** — evaluación de XP por tarea
- **Framer Motion** — animaciones puntuales (contador de XP, salida de tareas completadas)
- **Vitest** — tests de la lógica de negocio

## Setup

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Variables de entorno** — copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — de tu proyecto en Supabase (Settings → API).
   - `DEEPSEEK_API_KEY` — de tu cuenta de DeepSeek.
   - `DEEPSEEK_DAILY_LIMIT` — tope de evaluaciones de IA por usuario/día (default 50).

3. **Configurar Google OAuth en Supabase** (solo para login/identidad):
   - En Supabase Dashboard → Authentication → Providers → Google, habilita el proveedor.
   - No se requiere la Tasks API; solo OAuth para identidad.

4. **Aplicar el schema de Supabase** (requiere el [CLI de Supabase](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```

5. **Correr en desarrollo**
   ```bash
   npm run dev
   ```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Corre los tests (Vitest) |

## Cómo funciona

1. Inicia sesión con Google (solo identidad, sin scopes adicionales).
2. Crea y completa tareas directamente en la app. Cada tarea nueva se evalúa con DeepSeek para asignarle un valor de XP (con caché por descripción y límite diario).
3. Al completar una tarea, se acredita el XP a tu balance.
4. En `/rewards` defines tu propio catálogo: recompensas de tienda (canje directo) y cofres (costo fijo por abrir, premio aleatorio ponderado por rareza entre los `chest_item` que definas).

## Diseño visual

La identidad visual es un "libro de cuentas de misiones": las tareas son
entradas de un ledger, el XP es una moneda que se contabiliza, las
recompensas son tickets sellados. Paleta de tinta cálida + verde musgo +
oro latón (sin terracota ni acentos neón), tipografía Roboto Slab para
títulos e IBM Plex Mono para todo valor numérico (XP, costos), esquinas
rectas (4-6px), y divisores punteados entre filas de tareas en vez de
tarjetas apiladas. Tokens definidos en `app/globals.css`.

## Seguridad

- Todas las rutas API verifican la sesión vía `auth.getUser()` (round-trip real a Supabase), nunca confían en un ID de usuario que venga del cliente.
- El cliente `service_role` (que salta Row Level Security) siempre filtra explícitamente por `user_id` en cada query.
- El canje de recompensas es atómico a nivel de base de datos (`redeem_xp_if_sufficient`), evitando doble gasto por condición de carrera.

## Documentación de diseño

Los specs y planes de implementación completos viven en `docs/superpowers/`:
- `docs/superpowers/specs/` — decisiones de diseño (backend MVP, rediseño de frontend)
- `docs/superpowers/plans/` — planes de implementación tarea por tarea
