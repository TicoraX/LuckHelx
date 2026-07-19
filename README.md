# Sistema de Recompensas

Convierte tus tareas de Google Tasks en experiencia (XP): una IA (DeepSeek) evalúa
la dificultad de cada tarea, y el XP acumulado se gasta en una tienda y en cofres
con premios que tú mismo defines.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** — Postgres, Auth (Google OAuth), RLS
- **DeepSeek API** — evaluación de XP por tarea
- **Google Tasks API** — sincronización, creación y completado de tareas
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
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — de un OAuth Client "Web application" en Google Cloud Console, con la Tasks API habilitada. El redirect URI autorizado debe ser `https://<tu-proyecto>.supabase.co/auth/v1/callback`. Estos mismos valores también se configuran en Supabase Dashboard → Authentication → Providers → Google.
   - `CRON_SECRET` — cualquier string largo random, propio.
   - `DEEPSEEK_DAILY_LIMIT` — tope de evaluaciones de IA por usuario/día (default 50).

3. **Aplicar el schema de Supabase** (requiere el [CLI de Supabase](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```

4. **Correr en desarrollo**
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

1. Al iniciar sesión con Google (scope `tasks`), la app guarda un refresh token para leer/escribir en tu Google Tasks.
2. Un cron (`/api/cron/sync`, cada 15 min en Vercel) o el botón "Sincronizar ahora" trae tareas nuevas, les pide a DeepSeek un valor de XP (con caché por descripción y límite diario), y detecta tareas marcadas completadas en Google Tasks para acreditar el XP.
3. También puedes crear y completar tareas directo desde la app (`/api/tasks/create`, `/api/tasks/complete`), sin pasar por Google Tasks primero.
4. En `/rewards` defines tu propio catálogo: recompensas de tienda (canje directo) y cofres (costo fijo por abrir, premio aleatorio ponderado por rareza entre los `chest_item` que definas).

## Seguridad

- Todas las rutas API verifican la sesión vía `auth.getUser()` (round-trip real a Supabase), nunca confían en un ID de usuario que venga del cliente.
- El cliente `service_role` (que salta Row Level Security) siempre filtra explícitamente por `user_id` en cada query.
- El canje de recompensas es atómico a nivel de base de datos (`redeem_xp_if_sufficient`), evitando doble gasto por condición de carrera.
- `CRON_SECRET` se compara con `crypto.timingSafeEqual`.

## Documentación de diseño

Los specs y planes de implementación completos viven en `docs/superpowers/`:
- `docs/superpowers/specs/` — decisiones de diseño (backend MVP, rediseño de frontend)
- `docs/superpowers/plans/` — planes de implementación tarea por tarea
