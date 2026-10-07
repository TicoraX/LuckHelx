# Especificación Técnica HU-06: Rangos CS2 Premier Rating y Hábitos Recurrentes

**Módulo:** Recompensas & Gamificación (EStiri / LuckHelx)  
**Fecha:** 2026-10-07  
**Autor:** Tech Lead (EStiri Engineering)  
**Destinatario:** CEO (Usuario + Antigravity Core)  
**Rama:** `feat/sprint-2-premier-ranks`  
**Estado:** ESPECIFICACIÓN APROBADA PARA IMPLEMENTACIÓN

---

## 1. Resumen Ejecutivo y Alcance

La HU-06 expande el sistema de gamificación de LuckHelx incorporando el **CS2 Premier Rating** (escala de 1,000 a 35,000+ puntos), complementando el sistema de rangos tradicionales (Silver I a Global Elite).

A diferencia de los rangos lineales por XP acumulada estática, el CS2 Premier Rating es una **métrica viva de consistencia y cadencia de hábitos**:
1. Premia el volumen de actividad en una ventana móvil semanal (últimos 7 días).
2. Bonifica exponencialmente a través del multiplicador de racha activa (`lib/streak.ts`).
3. Incorpora el factor de consistencia en misiones diarias (`lib/quests.ts`).
4. Implementa **Rank Decay (Degradación por Inactividad)** cuando el usuario pasa más de 2 días sin completar tareas o misiones, incentivando la recurrencia con un piso calibrado no frustrante (mínimo absoluto 1,000 pts).

---

## 2. Reglas Inmutables del Dominio

1. **Escala CS2 Premier Rating:** 1,000 a 35,000+ puntos con piso calibrado en 1,000 puntos.
2. **Las 7 Bandas de Color Oficiales CS2 Premier:**
   - **Gris (Grey):** 1,000 - 4,999 pts (`#b0c3d9` / fondo oscuro `#1f242d`, border `#4b5563`)
   - **Celeste (Light Blue):** 5,000 - 9,999 pts (`#5e98d9` / fondo oscuro `#13253a`, border `#38bdf8`)
   - **Azul (Blue):** 10,000 - 14,999 pts (`#4b69ff` / fondo oscuro `#151d42`, border `#4b69ff`)
   - **Violeta (Purple):** 15,000 - 19,999 pts (`#8847ff` / fondo oscuro `#261447`, border `#8847ff`)
   - **Rosa (Pink):** 20,000 - 24,999 pts (`#d32ce6` / fondo oscuro `#38143d`, border `#d32ce6`)
   - **Rojo (Red):** 25,000 - 29,999 pts (`#eb4b4b` / fondo oscuro `#3d1515`, border `#eb4b4b`)
   - **Dorado (Gold / World Elite):** 30,000+ pts (`#ffd700` / fondo oscuro `#3d3211`, border `#ffd700`)
3. **Mecánica de Rank Decay:**
   - Periodo de gracia: 2 días (48 horas) de inactividad sin penalización.
   - Si `días_inactivo > 2`, se aplica un decaimiento progresivo diario:
     $$\text{decay} = (\text{días\_inactivo} - 2) \times 250\text{ pts}$$
   - El rating decaído nunca puede ser inferior a 1,000 pts (piso calibrado de entrada).
4. **Retrocompatibilidad Estricta:**
   - Las funciones y tipos existentes en `lib/ranks.ts` (`CS2_RANKS`, `getCs2Rank`, `UserRankProgress`) se conservan sin romper firmas ni contratos existentes.
5. **Cero Dependencias Infladas (Ponytail/Karpathy):**
   - Animación y estilizado vía Tailwind CSS / CSS puro.
   - Audio procedural nativo vía Web Audio API conectando al `MasterGainNode` en `lib/sound.ts`.
6. **Accesibilidad (WCAG 2.2 AA):**
   - Textos con contraste superior a 4.5:1.
   - Indicadores semánticos ARIA en badges y barras de progreso (`role="progressbar"`).
   - Respeto a `prefers-reduced-motion`.

---

## 3. Evaluación de Trade-Offs de Diseño (/gstack /autoplan)

### Trade-Off 1: Rating en Base de Datos vs. Cálculo Determinista On-The-Fly
- **Opción A (Almacenar rating en columna `users.premier_rating`):** Requiere migraciones DDL, cron jobs o triggers de base de datos para recalcular decay todos los días a medianoche.
- **Opción B (Cálculo determinista en función del estado de tareas y rachas, Seleccionada):**
  - Dado que la lista de tareas completadas (`completed_at`) y la racha (`lib/streak.ts`) ya residen en la base de datos y se envían en `/api/state`, el cálculo de la ventana semanal de 7 días, racha y decay por inactividad es **100% determinista, puro y testeable sin efectos secundarios**.
  - Si en el futuro se requiere persistir una instantánea de temporada o leaderboard histórico, se puede capturar sin alterar la pureza del motor de cálculo.

### Trade-Off 2: Multiplicador de Racha y Balance de Puntos
- Para permitir transicionar orgánicamente entre las 7 bandas:
  - Base de calibración mínima: 1,000 pts.
  - Tareas en ventana móvil de 7 días: cada tarea acreditada aporta un valor sustancial (ej. 400 pts base).
  - Tareas recurrentes (diarias/semanales) o misiones completadas aportan un bonus de consistencia (200 pts por quest).
  - Multiplicador de racha activa:
    $$M_{\text{streak}} = 1.0 + \min(1.0, \text{streakDays} \times 0.05)$$
    (Una racha de 7 días otorga 1.35x; 20 días otorga el tope de 2.0x).
  - XP histórica: para reconocer el progreso global del jugador, una fracción calibrada de la XP total acumulada ($10\%$ de la XP natural, topeada o amortiguada) se añade a la base de rating, asegurando que veteranos con alto nivel mantengan una base sólida mientras su actividad semanal define la banda pico.

---

## 4. Especificación de la API de Dominio (`lib/ranks.ts`)

```typescript
export interface PremierTier {
  tier: number; // 1 a 7
  id: 'grey' | 'light_blue' | 'blue' | 'purple' | 'pink' | 'red' | 'gold';
  name: string;
  minRating: number;
  maxRating: number; // 35,000 o Infinity para el tier dorado
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}

export interface PremierRatingInput {
  totalXpUnits?: number;
  weeklyCompletedTasks: number; // Tareas acreditadas en últimos 7 días
  streakDays: number;
  dailyQuestsCompleted?: number;
  daysSinceLastActivity?: number;
}

export interface PremierRatingProgress {
  rating: number; // Rating efectivo final tras multiplicador y decay
  rawRating: number; // Rating antes de aplicar el decay
  decayAmount: number; // Puntos restados por inactividad (> 2 días)
  daysInactive: number;
  isDecayed: boolean;
  tier: PremierTier;
  nextTier: PremierTier | null;
  progressPercent: number; // 0 - 100 dentro del tier actual
  streakMultiplier: number; // Factor aplicado (1.0x - 2.0x)
  formattedRating: string; // ej. "14,850" o "31,200"
}
```

### Funciones Principales:
1. `getPremierTier(rating: number): PremierTier`
2. `calculateStreakMultiplier(streakDays: number): number`
3. `calculatePremierDecay(rawRating: number, daysInactive: number): { rating: number; decayAmount: number }`
4. `calculatePremierRating(input: PremierRatingInput): PremierRatingProgress`
5. `formatPremierRating(rating: number): string`
6. `derivePremierStatsFromTasks(tasks: Array<{ completed_at: string | null; status: string }>, totalXpUnits?: number, now?: Date): PremierRatingProgress`

---

## 5. Arquitectura del Componente Visual (`components/PremierRatingBadge.tsx`)

### Características de Diseño (Estilo CS2 Premier):
- Tipografía monoespaciada para los dígitos numéricos con separador de miles.
- Insignia con gradiente dinámico y halo sutil (`box-shadow`) que coincide con la banda de color oficial de CS2.
- Barra de progreso delgada de alta resolución (`height: 3px` o `4px`) integrada en la base del badge, indicando el avance hacia el próximo umbral de banda (ej. hacia 15,000 o 20,000).
- Tooltip informativo detallado accesible: muestra desglose de rating, banda actual, multiplicador de racha, estado de decay si aplica, y puntos faltantes para el siguiente tier.
- Indicador visual sutil de advertencia de decay cuando `daysInactive > 2` (icono o texto de penalización por inactividad).

---

## 6. Integración de Audio Procedural (`lib/sound.ts`)

- Implementación del método `playRankPromotionSound()`:
  - Fanfarria ascendente brillante con 5 notas en arpegio triunfante (C5, E5, G5, B5, C6).
  - Enrutamiento obligatorio a través de `this.masterGain ?? this.ctx.destination` para respetar los controles globales de volumen y muteo.
  - Envelope ADSR rápido y limpio sin saturación ni clicks de fase.

---

## 7. Plan de Verificación & Acceptance Gates (G11)

1. **Unit Testing (`lib/ranks.test.ts`):**
   - Pruebas para todas las 7 bandas de color y límites de rating (1,000, 4,999, 5,000, 9,999, 10,000, 14,999, 15,000, 19,999, 20,000, 24,999, 25,000, 29,999, 30,000, 35,000+).
   - Prueba del multiplicador de racha (1 día = 1.05x, 7 días = 1.35x, 20+ días = 2.0x max).
   - Prueba de Rank Decay:
     - 0 o 1 o 2 días de inactividad: 0 decay.
     - 3 días de inactividad: 1 día de decay (250 pts).
     - 6 días de inactividad: 4 días de decay (1,000 pts).
     - Inactividad extrema: decay respeta piso absoluto de 1,000 pts.
   - Prueba de casos borde: rating negativo, NaN, inputs vacíos.
   - Prueba de derivación automática desde historial de tareas (`derivePremierStatsFromTasks`).
2. **Build & Lint:**
   - `npm test`: 100% pruebas pasando.
   - `npm run build`: compilación de Next.js sin errores de TypeScript ni estáticos.
   - `oxlint`: 0 errores y 0 warnings en los archivos nuevos o editados.
3. **Registro en `GATES.md`:**
   - Registrar compuerta **G11** documentando la verificación y cumplimiento de todos los criterios de aceptación.
