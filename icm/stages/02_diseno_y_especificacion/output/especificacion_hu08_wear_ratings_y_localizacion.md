# Especificación Técnica HU-08: Condición de Armas en Inglés (Wear Ratings) y Selector de Localización (EN/ES)

**Módulo:** Recompensas, Catálogo & Localización (EStiri / LuckHelx)  
**Fecha:** 2026-10-07  
**Autor:** Tech Lead (EStiri Engineering)  
**Destinatario:** CEO (Usuario + Antigravity Core)  
**Sprint Planificado:** Sprint 3 (Próximo Sprint)  
**Estado:** ESPECIFICACIÓN GUARDADA EN BACKLOG DE SPRINTS

---

## 1. Resumen Ejecutivo y Alcance

La **HU-08** tiene como objetivo implementar la asignación y visualización auténtica de la **condición / desgaste de las armas (Wear Ratings / Floats)** en idioma inglés como estándar universal de CS2, junto con un sistema bilingüe de localización (**EN / ES**) para la interfaz y catálogo de LuckHelx.

### Problema Actual
1. Las skins ganadas en aperturas de cajas se almacenan sin un float ni condición fija asignada al ejemplar específico en `redemptions`, heredando únicamente el `priceWear` que Steam devolvió en el momento de cotizar.
2. La comunidad de CS2 utiliza exclusivamente la terminología en inglés para los desgastes (*Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred*) y acrónimos (*FN, MW, FT, WW, BS*). Las traducciones forzadas generan confusión y restan inmersión.
3. No existe un mecanismo para alternar entre español e inglés en la aplicación.

### Objetivos
1. **Asignación de Float y Condición en Drops**: Al abrir un cofre o ganar una batalla, cada skin recibe un valor de desgaste pseudo-aleatorio auténtico ($0.0000 \le \text{float} < 1.0000$) y su condición correspondiente en inglés.
2. **Terminología CS2 Universal en Inglés**: Los desgastes y siglas se presentan en inglés en el inventario, detalle de inspección, ruleta y contratos.
3. **Selector de Idioma Dual (EN / ES)**:
   - **Opción A (Header)**: Botón de alternancia rápido `[ES | EN]` semántico en la cabecera junto a los toggles de sonido y tema.
   - **Opción B (Configuración)**: Selector formal en el modal de Ajustes (`SettingsModal.tsx`) con persistencia en la tabla `meta` (`language: 'es' | 'en'`) y en `localStorage`.

---

## 2. Reglas Inmutables del Dominio (CS2 Wear System)

### 2.1 Rangos Oficiales de Desgaste (Wears & Float Ranges)
Cada arma posee un valor flotante $\text{float} \in [0.00, 1.00]$ clasificado en las 5 bandas canónicas de Valve:

| Acrónimo | Condición Oficial (EN) | Traducción Referencial (ES) | Rango de Float | Probabilidad Ponderada CS2 |
|---|---|---|---|---|
| **FN** | **Factory New** | Recién Fabricado | $0.0000 - 0.0699$ | ~3% (raro) |
| **MW** | **Minimal Wear** | Desgaste Mínimo | $0.0700 - 0.1499$ | ~24% |
| **FT** | **Field-Tested** | Algo Desgastado | $0.1500 - 0.3799$ | ~43% (más común) |
| **WW** | **Well-Worn** | Bastante Desgastado | $0.3800 - 0.4499$ | ~15% |
| **BS** | **Battle-Scarred** | Deplorable | $0.4500 - 1.0000$ | ~15% |

*Excepciones de dominio:* Los cuchillos y guantes tipo "vanilla" no admiten float ni desgaste en el nombre de mercado de Steam.

### 2.2 Inmutabilidad Histórica
- Las redemptions previas que no posean `wear` o `float_value` se tratarán como `Field-Tested (FT)` de referencia por retrocompatibilidad, sin reescribir ni mutar registros históricos inmutables.
- Toda nueva tirada genera y persiste su float específico de por vida en la base de datos SQLite.

---

## 3. Modelo de Datos y Esquema SQLite

### Migración Idempotente en `lib/db.ts` (`initSchema`)
```sql
-- Agregar columnas opcionales a redemptions para el ejemplar específico
ALTER TABLE redemptions ADD COLUMN item_wear TEXT;
ALTER TABLE redemptions ADD COLUMN item_float REAL;

-- Persistencia del idioma en la tabla meta
-- Clave: 'language', Valor: 'es' | 'en' (default: 'es')
```

---

## 4. Arquitectura de Localización (EN / ES)

### 4.1 Diccionario Ligero Tipado (`lib/i18n.ts`)
Zero dependencias infladas (sin bibliotecas externas pesadas). Objeto plano inmutable con contratos estrictos de TypeScript:

```ts
export type Language = 'es' | 'en';

export const DICTIONARY = {
  es: {
    wears: {
      FN: 'Factory New',
      MW: 'Minimal Wear',
      FT: 'Field-Tested',
      WW: 'Well-Worn',
      BS: 'Battle-Scarred',
    },
    common: {
      sell: 'Vender',
      inspect: 'Inspeccionar',
      inventory: 'Inventario',
      rewards: 'Cajas',
      tasks: 'Tareas',
      battles: 'Case Battles',
      settings: 'Ajustes',
    },
  },
  en: {
    wears: {
      FN: 'Factory New',
      MW: 'Minimal Wear',
      FT: 'Field-Tested',
      WW: 'Well-Worn',
      BS: 'Battle-Scarred',
    },
    common: {
      sell: 'Sell',
      inspect: 'Inspect',
      inventory: 'Inventory',
      rewards: 'Cases',
      tasks: 'Tasks',
      battles: 'Case Battles',
      settings: 'Settings',
    },
  },
} as const;
```

### 4.2 Persistencia Dual (Servidor / Cliente)
- **Servidor (`meta` en SQLite)**: `GET /api/settings` entrega `{ language: 'es' | 'en' }`. `POST /api/settings` permite actualizarlo.
- **Cliente (`localStorage` + Context/State)**: Cambio reactivo instantáneo a 0ms sin recargar la página.

---

## 5. Componentes de UI y Flujo de Interacción

1. **Header ([components/Header.tsx](file:///a:/Proyectos/EStiri/components/Header.tsx))**:
   - Selector semántico con botón accesible `ES / EN`:
     - Renderiza botón con clase `lang-toggle` y `:active { transform: scale(0.97); }`.
     - Atributos ARIA: `aria-label="Cambiar idioma (Switch language)"`.
2. **Modal de Configuración ([components/SettingsModal.tsx](file:///a:/Proyectos/EStiri/components/SettingsModal.tsx))**:
   - Sección **Idioma / Language**:
     - Radios o botones estilizados: `Español (ES)` y `English (EN)`.
     - Guardado conjunto en la mutación de economía y sonido.
3. **Tarjeta de Inventario y Modal de Detalle**:
   - Badge de desgaste estilizado estilo CS2: `[FT] Field-Tested` con barra de float indicadora visual ($0.00 \rightarrow 1.00$).

---

## 6. Criterios de Aceptación y Compuertas (DoD / G12)

- [ ] **G12.1:** Todo drop de cofre genera un float válido entre $0.0000$ y $0.9999$ y asigna el desgaste correspondiente en inglés.
- [ ] **G12.2:** La condición del arma se muestra en inglés (*Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred*) en todas las vistas de inventario y detalle.
- [ ] **G12.3:** El selector de idioma en el Header y en Configuración permite alternar entre `ES` y `EN` reactivamente.
- [ ] **G12.4:** La preferencia de idioma persiste entre sesiones en SQLite `meta.language` y `localStorage`.
- [ ] **G12.5:** Suite de pruebas en Vitest (`lib/wear.test.ts` y `lib/i18n.test.ts`) con 100% de cobertura en cálculos de float y resolución de textos.
- [ ] **G12.6:** Cero advertencias en `oxlint` y `biome`, y compilación limpia en `npm run build`.
