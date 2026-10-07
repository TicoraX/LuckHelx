# Backlog de Sprints — LuckHelx (Sistema de Recompensas)

**Proyecto:** LuckHelx  
**Repositorio:** `https://github.com/TicoraX/LuckHelx`  
**Tablero Trello:** `LuckHelx: Sistema de Recompensas` (`6ac5bd017ead784c9f7aac9c`)  
**Fecha de Actualización:** 2026-10-07  
**Estado:** Sprint 2 Concluido con Éxito — Planificación Abierta para Sprint 3  

---

## 1. Historial de Sprints

### Sprint 1: Fundaciones y Mecánica Central de Recompensas (CERRADO)
- **Alcance:**
  - Sistema de XP basado en centésimas enteras (1 XP = 100 unidades).
  - Apertura física de cajas CS2 con animación de carrete pseudo-aleatorio.
  - Síntesis de audio procedural en Web Audio API (ticks, drops, level up).
  - Catálogo de cajas y skins reales de CS2 reconciliado en SQLite.
  - Misiones diarias, rachas de actividad y contratos de trade-up.
- **Compuertas:** Certificadas G1 a G9 (198 tests pasando).

---

### Sprint 2: Competitividad, Rango Premier y Refinamiento CS2 (CERRADO)
- **Alcance:**
  - **HU-05 (Case Battles 1v1)**: Duelos contra bots temáticos con carretes duales sincronizados, reglas de ganador se lleva todo y ledger inmutable (Compuerta G10).
  - **HU-06 (CS2 Premier Rating)**: Rango competitivo de 1,000 a 35,000+ puntos, 7 bandas de color canónicas de Valve, bonificación por racha, consistencia semanal y degradación por inactividad (> 2 días sin actividad) (Compuerta G11).
  - **Refinamiento de Toolchain en Rust**: Formateo instantáneo y ordenamiento de imports con `biome`, análisis estático con `oxlint`, erradicación total de emojis en UI y aguja CS2 milimétrica.
  - **Paridad 1:1 en Ventas de Inventario**: Erradicación del recorte previo del 60%, garantizando que cada venta equivalga exactamente al valor de mercado en dólares y centavos (1 USD = 1.00 XP).
- **Compuertas:** Certificadas G10 y G11 (230 tests pasando al 100%, 31 rutas Next.js limpias).

---

## 2. Próximo Sprint (Sprint 3)

### HU-07: Inmersión Sonora — Music Kits de CS2 y Sonido Ambiente
- **Prioridad:** Media-Alta
- **Descripción:** Integración de kits de música oficiales de CS2 (MVP con himnos de victoria y ambientación de menú), conectados al `MasterGainNode` centralizado y conmutables desde ajustes.
- **Criterio de Éxito:** Módulo de reproducción reactivo con control de volumen independiente y fallback procedural.

### HU-08: Condición de Armas en Inglés (Wear Ratings) & Selector de Localización (EN/ES)
- **Prioridad:** Alta (Solicitado por el usuario)
- **Especificación Técnica:** [icm/stages/02_diseno_y_especificacion/output/especificacion_hu08_wear_ratings_y_localizacion.md](file:///a:/Proyectos/EStiri/icm/stages/02_diseno_y_especificacion/output/especificacion_hu08_wear_ratings_y_localizacion.md)
- **Descripción:**
  1. **Wear Ratings en Inglés (Estándar CS2)**:
     - Asignación de float pseudo-aleatorio ($0.0000 \le \text{float} < 1.0000$) en cada drop de caja y batalla.
     - Clasificación y etiquetas oficiales en inglés:
       - `Factory New (FN)` ($0.00 - 0.07$)
       - `Minimal Wear (MW)` ($0.07 - 0.15$)
       - `Field-Tested (FT)` ($0.15 - 0.38$)
       - `Well-Worn (WW)` ($0.38 - 0.45$)
       - `Battle-Scarred (BS)` ($0.45 - 1.00$)
     - Visualización estilizada en la tarjeta de inventario y modal de inspección con barra indicadora de float.
  2. **Selector de Localización (EN / ES)**:
     - **Opción A (Header)**: Botón de alternancia rápido `[ES | EN]` semántico y accesible en la barra de navegación principal.
     - **Opción B (Configuración)**: Selector formal en el modal de Ajustes (`SettingsModal.tsx`) con persistencia en `meta.language` y `localStorage`.
     - Diccionario tipado ligero (`lib/i18n.ts`) sin librerías externas pesadas.
- **Compuerta de Aceptación:** G12 (6 criterios formales definidos en especificación).
