# Accesibilidad y claridad (issue #12)

## Por qué

El dueño pidió (issue #12): "Que se entienda qué hace cada pantalla y cada control sin
explicación previa. Que la interfaz se sienta interactiva [...]. Contraste, objetivos
táctiles de 44 px, navegación por teclado y lector de pantalla. Celular (360 px) además
de escritorio. Salida esperada: lista priorizada de hallazgos con capturas, y después
arreglos por apartado."

## Cómo se decidió

Un consejo de 2026-11-07 hizo la auditoría en dos rondas. La ronda 1 fue de solo lectura, con
Playwright contra `next dev` sobre una copia `VACUUM INTO` de la base, en escritorio
1440x900 y en móvil 360x780:
- tres auditores Haiku, uno por zona: Dashboard y encabezado (A), Recompensas y cofres (B),
  Inventario, Upgrade y Estado de cuenta (C);
- un Sonnet de medición transversal (T) que midió contraste, foco, modales, movimiento y
  anuncios.

En la ronda 2, el Sonnet verificó cada hallazgo P0 y P1. De 45, quedaron 29 confirmados,
2 falsos y 6 sin evidencia; el resto bajó a P2.

Los ids de los hallazgos (`A-03`, `C-01`, etc.) remiten a esas posiciones del consejo, que
quedaron fuera del repo.

## Lo medido

- **Foco visible:** ningún botón ni link queda sin anillo `:focus-visible` (20 combinaciones
  de ruta, tema y ancho). El anillo verde de 2 px mide 5,57:1 contra el fondo.
- **Inputs y selects:** tienen `outline: none` (`globals.css:832`). El input de nueva tarea
  no cambia nada al recibir el foco.
- **Táctil:** con emulación táctil real (`pointer: coarse`), ningún control queda por debajo
  de 44 px gracias a `globals.css:2290-2305`. La única excepción es `← Volver` en privacy y
  terms, de 136x17. Los 32 px que se ven en escritorio cumplen el mínimo AA de 24 px.
- **Contraste:** el único texto activo que falla AA es el badge Éxito/Fallo del upgrade
  (4,25:1, 4,11:1 y 3,82:1 en oscuro). A eso se suma el `#fff` fijo sobre el acento en
  `HelpModal` (3,49:1).
- **Modales:** `Modal.tsx` atrapa el foco, cierra con Escape, devuelve el foco y tiene nombre
  accesible. Lo verificamos en vivo con Ajustes y con el detalle del cofre. El escenario
  del carrete **no** usa `Modal`.
- **Alto en 360 px:** `/inventory` mide 12 119 px y baja a 7258 px con 2 columnas; `/ledger`
  mide 19 716 px.

## Decisiones

### 1. Bugs de comportamiento

1. **C-01 (P0):** desde el teclado no se puede vender en el inventario. El `onKeyDown` del
   `article role=button` (`app/inventory/page.tsx:589`) hace `preventDefault` sobre el Enter
   o el Espacio que van a "Vender". Además, un `role=button` con un botón adentro vuelve
   presentacionales a sus hijos para el lector. Al terminar, deben cumplirse cuatro cosas:
   - Enter y Espacio sobre "Vender" venden.
   - La tarjeta se puede abrir desde el teclado.
   - Un clic con el mouse en la tarjeta sigue abriendo el detalle.
   - No queda ningún control interactivo anidado dentro de un `role=button`.
2. **A-04:** el aviso de subida de nivel (`app/page.tsx:97-100`) usa `floor(x/100)`, mientras
   que la barra usa `100 * XP_SCALE`. Por eso dice "nivel 759" cuando la barra muestra
   "Nivel 8", y suena cada vez que se cruza 1 XP. La fórmula del nivel pasa a una función
   pura de `lib/xp.ts`, que usan los dos, con un test en el archivo de tests de xp que ya
   existe.
3. **A-03:** las teclas 1 a 4 (`KeyboardShortcuts.tsx:33`) navegan aunque haya un modal
   abierto. Deben ignorarse si hay un `dialog[open]` o un `[aria-modal="true"]`.
4. **A-09:** `HelpModal.tsx:76` menciona Google Tasks, que no existe en la app. Se borra la
   frase.

### 2. Anuncios para el lector

5. **Toast (T1):** el contenedor `aria-live` de `Toast.tsx` queda siempre montado, incluso
   vacío y sin ocupar alto.
6. **Revelado (B-03 y B-04):** la rareza se muestra en español con `RARITY_LABEL`
   (`ChestCard.tsx`). La región live dice un solo texto: "Obtuviste <objeto>, rareza
   <rareza>". El botón queda afuera.
   - Aplica en `rewards/page.tsx`, `BatchOpeningModal`, los chips del Trade-Up
     (`inventory:371`) y `globals.css:1509`.
   - Se quita el `text-transform: uppercase` de la rareza solo donde el lector la lee.
7. **Contadores y veredictos (B-08, B-11, C-05):**
   - el veredicto del duelo y los contadores de selección "N / 10" llevan
     `aria-live="polite"`;
   - las tarjetas de bot llevan `aria-pressed`.
8. **Errores (A-12, A-13):**
   - los errores de `DailyQuestsWidget` y de `DailySpinModal` llevan `role="alert"`;
   - el `catch` vacío de `DailyQuestsWidget.tsx:25` pasa a un estado de error honesto con
     un botón Reintentar. Lo exige la regla global de fallbacks sin datos inventados.
9. **Filas fantasma (ledger y tareas):** las filas de relleno "—" llevan `aria-hidden`.

### 3. Teclado y foco

10. **A-01:** `input:focus-visible`, `select:focus-visible` y `textarea:focus-visible` usan
    el mismo anillo que los botones.
11. **Escenario del carrete (B-02 y T3, en `rewards/page.tsx:629`):** al abrirse, el foco
    entra al escenario (contenedor con `tabIndex=-1` y nombre "Abriendo <caja>") y el resto
    de la página queda `inert`. Al cerrarse, el foco vuelve a la tarjeta, como ya ocurre
    con Escape.
    [Arbitraje: T proponía sumar un botón "Saltar". Queda fuera, porque Escape ya cierra y
    con `prefers-reduced-motion` el carrete resuelve al instante. Lo que falla hoy es el
    foco, no la falta de un atajo.]
12. **Pestañas Tienda / Cofres / Colección (B-01):** llevan `role=tablist`, `role=tab` y
    `aria-selected`.
    [Arbitraje: sin navegación por flechas. El patrón ARIA completo no se pidió, y el Tab
    sigue funcionando.]
13. **Nombres accesibles:**
    - "Completar" y "Borrar" incluyen el nombre de la tarea (A-05);
    - se quita `aria-label="Inicio"`, que no coincide con el texto visible "Dashboard"
      (A-07);
    - "5x" y "1v1" llevan `aria-label` (B-06);
    - Pomodoro lleva `aria-label`, `aria-expanded` y cierre con Escape (A-08);
    - los chips de rareza del Trade-Up y los sectores del upgrade llevan `aria-pressed`
      (C-05, C-06).

### 4. Movimiento reducido

14. `Confetti`, `AnimatedNumber` y `MultiChestReel` respetan
    `prefers-reduced-motion: reduce`:
    - el confeti no se dispara;
    - el número muestra directamente su valor final;
    - el 5x resuelve al instante, igual que `ChestReel`.

### 5. Contraste y táctil

15. **Contraste (A-15, T4):**
    - en `HelpModal`, el `#fff` fijo sobre el acento pasa a `var(--on-accent)`;
    - el texto del badge Éxito/Fallo pasa a `var(--text-main)`.
16. **Táctil (C-08):** el link `← Volver` de privacy y terms pasa a `inline-flex` con
    `min-height: 44px`.

### 6. Móvil 360 px

17. **Navegación duplicada (A-02):** en 360 px, el encabezado muestra 8 links con scroll
    interno oculto, que llega hasta x=1019, y además está la barra inferior. Con 640 px o
    menos, el encabezado oculta los links de página (Dashboard, Recompensas, Inventario,
    Upgrade, Estado de cuenta) y conserva Logros, Ayuda y Ajustes. La barra inferior se
    queda con las 5 páginas.
    [Arbitraje: T dejó abierto dónde viven Ajustes y Ayuda. Se quedan en el encabezado, que
    es donde ya están, y Logros sale de la barra inferior para que entren las 5 páginas sin
    que se corte "Estado". El constructor mide que en 360 px no se corte ningún ítem.]
18. **Input de nueva tarea (A-10):** a 360 px ocupa la fila completa; hoy mide 91 px.
19. **Inventario (C-02):** con 480 px o menos, `.inventory-grid` pasa a 2 columnas.
20. **Estado de cuenta (C-03):** con 640 px o menos, la fecha se muestra en formato compacto
    y el concepto y el XP se apilan en vez de dejar el concepto en 104 px. El grid inline
    de `ledger/page.tsx` gana sobre el CSS, así que hay que moverlo a una clase. Se mide el
    alto antes y después.

## Fuera de alcance

**Después:**
- `<table>` o encabezados de columna en el ledger (C-04, A-17). Hoy ya es `ul/li`.
- Botón pegajoso en el upgrade (C-07).
- Tope de filas y año en las fechas del ledger (C-09). Lo decide el dueño.
- Glosas y textos de rótulos (A-16, A-21, B-12, C-11).
- Selector de caja para el duelo (B-09). Es un cambio de producto.
- Flechas en las pestañas.
- Recarga del Pomodoro (A-18).
- Cursor y texto del heatmap (A-11).

**Nunca:**
- B-07 y T6: los 44 px ya existen en `pointer: coarse`.
- A-06: es falso, el anillo existe.
- A-24, A-25, C-10 y B-14: decoración sin defecto de uso.

## A criterio del constructor

- Cómo queda el marcado de la tarjeta del inventario, siempre que cumpla las cuatro
  condiciones de la decisión 1.
- Los textos de las regiones live, en español y sin jerga.
- La forma compacta de la fecha en el ledger.
