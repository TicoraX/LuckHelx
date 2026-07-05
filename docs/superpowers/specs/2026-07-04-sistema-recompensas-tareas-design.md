# Sistema de recompensas para tareas reales — Design

## Propósito

Sistema de gamificación que da XP por completar tareas de la vida real, evaluado
por IA (DeepSeek) según complejidad/tiempo estimado, canjeable por recompensas
que el propio usuario define. Objetivo: dar retroalimentación de dopamina
inmediata a tareas cotidianas sin depender de auto-asignación manual de puntos
(el problema de apps como Habitica).

Alcance inicial: uso personal. Diseñado para poder pasar a producto público/de
pago sin reescritura de arquitectura.

## Stack

- **Next.js** (frontend + API routes en un solo repo), desplegado en Vercel.
- **Supabase**: Postgres + Auth (login con Google) + Vault para secretos cifrados.
- **DeepSeek API**: evaluación de XP, llamada solo server-side.
- **PWA** vía `next-pwa` — instalable en móvil sin publicar en tiendas.
- **Google Tasks API**: fuente de tareas y detección de finalización.

Todas las herramientas son de uso libre en apps comerciales (Next.js MIT,
Supabase Apache 2.0, DeepSeek/Vercel/Google con ToS de API estándar sin
restricción de uso comercial, solo rate-limits a respetar).

## Arquitectura

```
Google Tasks (fuente de tareas)
        │ OAuth2 + Google Tasks API
        ▼
   Next.js app (Vercel)
   ├─ Frontend (React, PWA)
   ├─ API routes:
   │   ├─ /sync-tasks    → trae tareas nuevas/completadas de Google
   │   ├─ /evaluate-task → llama a DeepSeek, calcula XP
   │   └─ /redeem        → gasta XP en tienda/cofre
   └─ Supabase (Postgres + Auth)
        ├─ tabla tasks
        ├─ tabla rewards (catálogo definido por el usuario)
        └─ tabla user_xp (balance)
```

Flujo: login con Google (Supabase Auth) → autorización de Google Tasks → sync
periódico trae tareas nuevas → cada tarea nueva sin evaluar pasa una vez por
DeepSeek → al marcarse completada en Google Tasks, el siguiente sync detecta
el cambio y acredita el XP.

## Modelo de datos (Supabase/Postgres)

```
users (Supabase Auth)
  └─ id, email, xp_balance
  └─ api_key_encrypted (nullable, Vault) — reservado para "modo developer" (BYO key), no se usa en MVP

tasks
  └─ id, user_id, google_task_id, title, description
  └─ xp_value (asignado por DeepSeek)
  └─ xp_reasoning (texto corto: por qué ese XP — permite auditar inflado)
  └─ status: pending | evaluated | completed | credited
  └─ created_at, completed_at

rewards (catálogo definido por el usuario)
  └─ id, user_id, type: 'shop' | 'chest_item'
  └─ name, xp_cost, rarity (solo chest_item: common/rare/epic)

redemptions (historial de canjes)
  └─ id, user_id, reward_id, xp_spent, redeemed_at
```

## Evaluación IA y anti-abuso

- Al detectar una tarea nueva, una sola llamada a DeepSeek con título +
  descripción + duración estimada (si Google Tasks la tiene).
- Prompt fijo pide JSON `{xp, reasoning}` con rango orientativo (5-100xp).
- **Clamp de servidor**: el backend recorta el XP devuelto a un máximo
  configurable pase lo que pase — la defensa real contra inflado, no depende
  de que el prompt "se porte bien".
- **Caché**: tareas con título/descripción muy similares (comparación simple
  de texto) reusan el `xp_value` ya calculado; evita llamadas redundantes.
- **Rate limit diario**: tope de N llamadas a DeepSeek por usuario/día.
- **Timer opcional**: si el usuario lo activa, aplica un multiplicador leve
  (±20%) sobre el xp_value ya calculado — nunca lo reemplaza, y no requiere
  vigilar al usuario mientras trabaja.

## Recompensas

- **Tienda (fija)**: catálogo `rewards` con `type='shop'`, canje directo
  descontando XP, sin aleatoriedad.
- **Cofres**: cuestan XP fijo; el backend elige un `chest_item` al azar
  ponderado por `rarity` (común más probable que épico) — pesos simples,
  sin librería externa.

## Sincronización de finalización

Cron job (Vercel Cron) cada X minutos: compara tareas `completed` en Google
Tasks contra `credited` en la DB local; las recién completadas se acreditan
(`xp_balance += xp_value`, status → `credited`). Polling simple, sin
webhooks — volumen bajo (una persona, pocas tareas/día) no lo justifica.

## Fuera de alcance (MVP)

- **Modo developer (BYO API key)**: dejar la propia key de DeepSeek para
  saltarse el rate-limit compartido. Campo `api_key_encrypted` ya reservado
  en el modelo de datos para no migrar después. Se implementará en una rama
  separada (`feature/developer-mode`) cuando se decida construirlo.
- Multiusuario/leaderboard entre amigos.
- Evidencia por foto para verificación de tareas.
- Integraciones con Todoist/Notion (Google Tasks es la única fuente inicial).

## Reparto de trabajo (Claude + DeepSeek)

- **Claude**: integración de flujo completo (auth + sync + créditos de XP),
  lógica anti-abuso, decisiones de arquitectura.
- **DeepSeek**: piezas autocontenidas con spec de entrada/salida clara —
  componentes de UI (tienda/cofre), schema de Supabase, manifest PWA, parser
  de la respuesta de su propia API.
