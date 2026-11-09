# CS2 Real: Grado, Colores y Contrato Trade-Up (Issue #20)

## Por qué

El dueño pidió (issue #20):
> "Sobre el contrato, debería de abrir una interfaz por encima, la cual deje escoger las skins y que al darle al contrato, obviamente pregunte y que muestre la skin en medio al finalizar [...] si pones 10 de la caja snakebite, te debería salir una skin de esa propia caja, o si pones de otra por el porcentaje se balancea, además las épicas, deberían de verse rosas [...] gris, azul, morada, rosa, roja y bueno dorada [...] cuchillos/guantes [...] amarillos como distinción está bien."

## Cómo se decidió

La fase se evaluó con base en la investigación técnica (`docs/roadmap/01_cs2-real/investigacion/r1-tecnica.md`) y de mercado (`r1-mercado.md`):
- Los 6 grados de armas de CS2 más cuchillos/guantes ya tienen su código hexadecimal oficial guardado en `rewards.rarity_color` (datos procedentes del preset ByMykel/CSGO-API).
- El contrato actual en `lib/trade-up.ts` realiza `ORDER BY RANDOM()` sobre todo el tier siguiente de la base sin considerar la caja de origen ni el grado de CS2.
- La UI actual es un panel inline en `/inventory` sin modal, sin confirmación previa y sin animación de revelado.
- Cada contrato genera 10 filas de venta a $0 en `item_sales`, ensuciando el estado de cuenta.

## Lo medido

- **Base de datos (`rewards`)**:
  - `common`: 3.410 `#4b69ff` (Mil-Spec), 93 `#5e98d9` (Industrial), 87 `#b0c3d9` (Consumer).
  - `rare`: 2.731 `#8847ff` (Restricted).
  - `epic`: 2.292 `#d32ce6` (Classified), 2.109 `#eb4b4b` (Covert).
  - `legendary`: 670 `#eb4b4b` (cuchillos y guantes con `isRare = true`).
- **Trazabilidad de cajas (`redemptions` y `chest_contents`)**:
  - 89 de los 96 canjes existentes con objeto tienen caja de origen directa vía `chest_contents`.
  - Los 7 restantes provienen de canjes sintéticos previos (Trade-Up/Upgrade).
  - 9.187 objetos pertenecen a una única caja en todo el catálogo.
- **Probabilidades comunitarias verificadas de CS2**:
  $$P(\text{skin } X) = \frac{\text{entradas de la colección de } X}{10} \times \frac{1}{\text{skins del grado siguiente en esa colección}}$$

---

## Decisiones

### 1. Grado real vía función pura [Arbitraje: sin migración de BD]
No se altera el esquema de SQLite (`lib/db.ts`). Se implementa un módulo puro `lib/cs2-grade.ts` que deduce el grado real a partir de `rarity_color` y la condición de `legendary`:
- `#b0c3d9` → `'Consumer Grade'` (Gris)
- `#5e98d9` → `'Industrial Grade'` (Celeste)
- `#4b69ff` → `'Mil-Spec Grade'` (Azul)
- `#8847ff` → `'Restricted'` (Morado)
- `#d32ce6` → `'Classified'` (Rosa)
- `#eb4b4b` + `legendary` → `'Extraordinary'` (Dorado/Especial: Cuchillos y Guantes)
- `#eb4b4b` no legendary → `'Covert'` (Rojo)

### 2. Paleta de 7 colores oficiales en la interfaz
Se declaran tokens en `app/globals.css` y variables de grado:
- `--grade-consumer`: `#b0c3d9`
- `--grade-industrial`: `#5e98d9`
- `--grade-milspec`: `#4b69ff`
- `--grade-restricted`: `#8847ff`
- `--grade-classified`: `#d32ce6` (Rosa real para las épicas clasificadas)
- `--grade-covert`: `#eb4b4b` (Rojo)
- `--grade-special`: `#ffd700` / `#e4ae39` (Dorado distinguido para cuchillos y guantes)

Las 4 rarezas base de la app (`common`, `rare`, `epic`, `legendary`) se mantienen intactas en la economía y en `lib/rewards.ts` (invariante del proyecto), pero visualmente cada skin muestra su color de grado real.

### 3. Trazabilidad de colección y resolución de huérfanos [Arbitraje: fallback a primera caja]
Para determinar la colección de cada skin en el Trade-Up:
1. Se consulta la caja de origen del canje en `redemptions`.
2. Si el objeto proviene de un canje sintético (sin caja directa), se resuelve la primera caja asociada en `chest_contents`.
3. Si una colección no contiene skins en el grado siguiente (caso de colecciones sin salida), sus skins no son elegibles para el contrato de 10, notificándolo en la selección.

### 4. Fórmula de balanceo de CS2 en el backend (`lib/trade-up.ts`)
El backend valida que las 10 entradas pertenezcan al mismo grado.
1. Calcula la proporción de cada caja de entrada: $W_{\text{caja}} = \frac{N_{\text{entradas\_caja}}}{10}$.
2. Obtiene los candidatos de salida en el grado inmediatamente superior para cada caja.
3. Sortea primero la caja ganadora ponderada por $W_{\text{caja}}$ y luego selecciona uniformemente una de sus skins candidatas del grado siguiente.

### 5. Nuevo modal interactivo de Contrato (`components/TradeUpModal.tsx`)
1. **Acceso modal**: Se abre por encima desde el inventario mediante un modal accesible (`dialog role="dialog"` con captura de foco y cierre con `Escape`).
2. **Selección de 10 ranuras**: Selector de grado de entrada; grilla del inventario filtrada solo por ese grado; visualización de los 10 slots a llenar.
3. **Probabilidades en tiempo real**: Tabla/desglose con las cajas aportadas, sus porcentajes y los posibles resultados del grado siguiente.
4. **Compuerta de confirmación**: Diálogo previo "Firmar Contrato Trade-Up" con advertencia de quema irreversible.
5. **Revelado centrado**: Escenario animado con la skin obtenida en grande, su grado y color, confeti si es Classified/Covert, y botón "Enviar al inventario".

### 6. Registro unificado en el estado de cuenta
En lugar de 10 filas de venta a $0 en `item_sales`, el contrato registra una sola fila informativa en el ledger (`Contrato Trade-Up: 10x [Grado] → [Skin Ganada]`). El historial pasado no se altera.

---

## Fuera de alcance

- **Float y desgaste (Field-Tested, Factory New, etc.)**: Se mantiene para la Fase 03 / Issue #22.
- **Contrato de 5 Covert por cuchillo**: Diferido para pulido posterior tras consolidar el contrato estándar de 10 skins.
- **Cajas personalizadas**: Issue #18.
