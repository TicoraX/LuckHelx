# Frontend Redesign — Design

## Propósito

La interfaz actual (generada por Gemini como primer pase visual) es funcional pero
genérica: dark mode fijo con gradientes morados, sin animaciones más allá de
transiciones CSS básicas de hover. El objetivo es una identidad visual sobria y
editorial (referencia: sitio de Anthropic — tipografía cuidada, mucho espacio en
blanco, acentos de color moderados) con un nivel de interacción/animación que la
haga sentir viva, sin caer en exceso decorativo.

Alcance: las tres páginas existentes (`app/page.tsx` dashboard, `app/login/page.tsx`,
`app/rewards/page.tsx`), más un sistema de tema claro/oscuro nuevo.

## Sistema de tema (claro/oscuro)

- Variables CSS en `app/globals.css`, mismo nombre de token en ambos temas,
  valor distinto por tema vía `:root[data-theme="light"]` / `:root[data-theme="dark"]`.
- Sin build de tema propietario: se implementa a mano con CSS custom properties,
  cero dependencias nuevas.
- Toggle sol/luna (componente único `components/ThemeToggle.tsx`, client),
  persistido en `localStorage`. Si el usuario nunca lo tocó, se usa
  `prefers-color-scheme` del sistema como default.
- Dashboard y recompensas comparten la misma estructura de header (badge/nav/
  toggle) — se extrae a `components/Header.tsx` en vez de duplicar el markup
  en cada página. Login no lo usa: su estructura es una tarjeta centrada sin
  nav, distinta por diseño.
- Un script inline pequeño en `app/layout.tsx` (antes de hidratar React) lee
  `localStorage`/`prefers-color-scheme` y aplica `data-theme` al `<html>` de
  inmediato, para evitar el flash de tema incorrecto en la carga.

### Tokens

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#faf8f5` | `#1c1a17` |
| `--bg-card` | `#ffffff` | `#26231f` |
| `--text-main` | `#1c1a17` | `#f2ede6` |
| `--text-muted` | `#6b6459` | `#a39c8f` |
| `--accent` | `#a8583e` | `#d4805f` |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` |

El acento terracota se usa con moderación: XP badge, botón primario, hover de
links. Nada de gradientes decorativos ni glow — la jerarquía la dan la
tipografía y el espacio en blanco.

## Tipografía

Cargada vía `next/font/google` (self-hosted por Next, sin request externo):

- **Fraunces** (serif cálida) para títulos/headers — expuesta como variable
  CSS `--font-heading`.
- **Inter** (ya en uso) para cuerpo/UI — variable `--font-body`.

## Micro-interacciones

Se agrega `framer-motion` como dependencia nueva, pero acotada a los dos casos
donde de verdad gana su peso (~35KB gzip no se justifica para animaciones de
entrada simples que CSS ya resuelve bien):

- **`components/AnimatedNumber.tsx`** (Framer Motion): cuando el XP balance
  cambia, cuenta animada del valor viejo al nuevo (en vez de saltar directo) +
  pulso breve de color en el badge. Lograr un conteo con easing suave a mano
  es tedioso — aquí la librería sí gana su lugar.
- **Completar tarea** (Framer Motion, `AnimatePresence`): la fila de la tarea
  se desvanece y colapsa al desmontarse — animar la salida de un elemento que
  sale del DOM es el otro caso donde CSS puro se vuelve incómodo (`AnimatePresence`
  lo resuelve con una prop).
- **`components/FadeIn.tsx`** (CSS puro, `@keyframes` + `animation-fill-mode:
  forwards`): fade + slight slide-up al montar cada página (~300ms). Es una
  animación de entrada simple, sin desmontaje — no necesita la librería.
- **Revelar premio del cofre** (CSS puro): pop de escala + aparición del badge
  de rareza cuando la ruleta se detiene. Mismo motivo: entrada simple.

## Ruleta de cofres (estilo CS:GO)

Mecánica:

1. Al hacer click en "Abrir cofre", primero se llama a `/api/redeem` (ya existe,
   canje atómico) — el backend ya sabe el ítem ganador antes de que arranque
   cualquier animación. Nunca se anima "a ciegas": la ruleta siempre converge
   hacia un resultado ya determinado server-side.
2. Los ítems del reel tienen un **ancho fijo en CSS** (`120px`, `overflow: hidden`
   + `text-overflow: ellipsis` para nombres largos) — así `itemWidth` es una
   constante real y no depende de cuánto texto tenga cada ítem.
3. `lib/chest-reel.ts` expone una función pura:
   `buildReel(pool: ChestItem[], winnerId: string, itemWidth: number, containerWidth: number)`
   que arma una tira larga repitiendo ítems del pool en orden aleatorio, coloca
   el ítem ganador en una posición fija cerca del final, y calcula el
   `targetOffset` (px) para que ese ítem quede centrado bajo un marcador fijo.
   Esta función es pura y se testea con Vitest — es la única lógica real de
   este feature, el resto es maquetado/animación.
4. `components/ChestReel.tsx` (client) usa `buildReel` y anima `transform:
   translateX(...)` con una transición CSS (`cubic-bezier` de desaceleración,
   ~4-5 segundos) hasta el `targetOffset`. Sin librería adicional — es una sola
   transición lineal, no física interactiva.
5. Al detenerse, dispara el pop de escala + rareza (CSS puro, sección anterior).
6. Sin audio en esta fase (ver "Fuera de alcance").

## Fuera de alcance (esta fase)

- **Sonido** en la revelación de cofres/completar tareas — se evalúa después.
- **Animación de "choque contra pared"** al completar una tarea (idea: la fila
  de la tarea avanza y se estrella contra un borde con un hueco de silueta
  2D, se frena, y sigue de largo) — divertida pero requiere trabajo de
  animación/sprites significativo; queda anotada para una fase futura, no
  bloquea esta.
- Rediseño de la lógica de negocio — este spec es puramente visual/interacción,
  no toca rutas API, esquema de Supabase, ni lógica de XP/rate-limit.

## Testing

- `lib/chest-reel.ts` (`buildReel`): tests unitarios con Vitest — dado un pool
  fijo, un `winnerId`, y dimensiones fijas, el `targetOffset` calculado debe
  centrar exactamente ese ítem, y la tira debe contener el ganador en la
  posición esperada.
- El resto (tema, tipografía, animaciones de Framer Motion) se verifica
  manualmente en navegador — no hay lógica de negocio testeable ahí, es
  maquetado puro.

## Reparto de trabajo

- **Claude**: todo este spec — toca la mayoría de archivos existentes y
  necesita coherencia exacta entre tokens/tipografía/componentes.
- **Posible delegación futura**: una vez desglosado en tareas, el componente
  puramente visual `ChestReel.tsx` (sin la función `buildReel`, que se queda
  con Claude por ser lógica testeable) podría pasarse a Fable si se quiere
  pulir más su acabado visual — tarea aislada, sin lógica de negocio.
