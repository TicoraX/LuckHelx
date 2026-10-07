# Registro de Implementación Quirúrgica HU-06: Rangos CS2 Premier Rating y Hábitos Recurrentes

**Módulo:** Recompensas & Gamificación (EStiri / LuckHelx)  
**Fecha:** 2026-10-07  
**Autor:** Tech Lead (EStiri Engineering)  
**Rama:** `feat/sprint-2-premier-ranks`  
**Estado:** IMPLEMENTACIÓN COMPLETADA Y VERIFICADA

---

## 1. Resumen de Cambios

Se implementó el sistema de **CS2 Premier Rating** (escala de 1,000 a 35,000+ puntos) expandiendo el módulo de rangos y vinculándolo con la consistencia real de hábitos (ventana móvil de 7 días, racha activa y misiones diarias), preservando 100% la compatibilidad con el sistema de rangos tradicionales de CS2.

---

## 2. Archivos Modificados y Creados

### 2.1. `lib/ranks.ts` (Ampliación del Dominio)
- **7 Bandas Oficiales de CS2 Premier:**
  - `Gris`: 1,000 - 4,999 pts (`#b0c3d9`)
  - `Celeste`: 5,000 - 9,999 pts (`#5e98d9`)
  - `Azul`: 10,000 - 14,999 pts (`#4b69ff`)
  - `Violeta`: 15,000 - 19,999 pts (`#8847ff`)
  - `Rosa`: 20,000 - 24,999 pts (`#d32ce6`)
  - `Rojo`: 25,000 - 29,999 pts (`#eb4b4b`)
  - `Dorado`: 30,000 - 35,000+ pts (`#ffd700`)
- **Mecánica de Rank Decay por Inactividad:**
  - Período de gracia de 2 días.
  - Para $d > 2$ días de inactividad: decaimiento de 250 puntos por día.
  - Piso calibrado inviolable de 1,000 pts.
- **Multiplicador de Racha Activa:**
  - Base 1.0x, incrementos de +0.05x por día de racha, con tope calibrado de 2.0x (20 días).
- **Cálculo Determinista de Rating:**
  - `calculatePremierRating(input)` y `derivePremierStatsFromTasks(tasks, totalXpUnits, now)`.
  - Puntos por tarea en ventana móvil de 7 días (350 pts/tarea), puntos por misiones diarias (200 pts/misión), bonificación por XP histórica (1 pt por cada 10 XP naturales).
- **Retrocompatibilidad:**
  - Se mantuvieron intactos `CS2_RANKS`, `getCs2Rank` y `UserRankProgress`.

### 2.2. `lib/sound.ts` (Audio Procedural Valve-Style)
- Se incorporó `playRankPromotionSound()` a la clase `SoundFX` y se exportó la función auxiliar `playRankPromotionSound()`.
- Fanfarria de arpegio ascendente triunfal en notas C5, E5, G5, B5, C6 sintetizadas en osciladores triangulares con envolvente exponencial.
- Enrutado estrictamente a través de `this.masterGain ?? this.ctx.destination`.

### 2.3. `components/PremierRatingBadge.tsx` (Componente Visual Accesible)
- Insignia con estética CS2 Premier auténtica:
  - Resplandor y borde dinámicos acordes a la banda de color actual.
  - Tipografía monoespaciada con separador de miles.
  - Barra de progreso delgada de alta resolución (`role="progressbar"`, aria attributes).
  - Tooltip semántico descriptivo con desglose de banda, racha, decay y puntos faltantes.
  - Modo `compact` (para cabecera/barra de navegación) y modo widget completo (para dashboard).
  - Accesibilidad WCAG 2.2 AA (contraste superior a 4.5:1, etiquetas ARIA).

### 2.4. `components/Header.tsx` (Integración en Cabecera)
- Integración de `<PremierRatingBadge compact tasks={tasksList} xpUnits={balance} />` junto al clásico rank badge.
- Carga reactiva de tareas y balance vía props o fallback automático a `/api/state`.

### 2.5. `app/page.tsx` (Dashboard de Tareas y Hábitos)
- Pase explícito de `tasks={tasks}` al `Header`.
- Incorporación del widget `PremierRatingBadge` en el bloque de métricas principales junto a `XpProgressBar`, respondiendo a la actividad del usuario.

### 2.6. `lib/ranks.test.ts` (Cobertura de Pruebas Unitarias)
- Expansión de la suite de 3 a 16 pruebas automatizadas:
  - Preservación de pruebas clásicas de rangos CS2.
  - Verificación de las 7 bandas y valores en los límites de cada tier.
  - Escala y capping del multiplicador de racha (1.0x hasta 2.0x).
  - Mecánica de gracia (0-2 días) y decay progresivo (> 2 días).
  - Clamping estricto al piso mínimo de 1,000 pts.
  - Derivación automática con historial de tareas reales y ventana móvil de 7 días.
