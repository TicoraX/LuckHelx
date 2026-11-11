# Changelog: LuckHelx

Historial de cambios notables de LuckHelx. Formato basado en Keep a Changelog y Semantic Versioning.

## [0.3.0] - 2026-11-10

### Agregado
* Sistema canónico de float y desgaste de CS2 (HU-07 / #22):
  - Generación de float IEEE-754 con interpolación `[min, max]` precisa para cada arma según `cs2-float-ranges.json`.
  - Clasificación en los cinco rangos canónicos oficiales: Recién Fabricado (FN < 0.07), Casi Nuevo (MW < 0.15), Algo Desgastado (FT < 0.38), Bastante Desgastado (WW < 0.45) y Con Alto Desgaste (BS <= 1.00).
  - Componente accesible `FloatBar` con marcadores de grado y aguja indicadora de posición.
  - Indicador de float en tarjetas de inventario y desglose detallado en el modal de inspección.
  - Preservación y consumo FIFO de float por unidad en inventario, ventas y contratos de Trade-Up (#19).
* Unificación de carretes y escalado responsive (#15):
  - Hook centralizado `useChestReelSequence` para sincronizar animación, precarga y sonido mono-tira.
  - Escalado fluido mediante `clamp(150px, 14vw, 220px)` en monitores 1440p+ y compactación táctil bajo 480 px.
  - Skeletons animados con efecto `pulse` en tarjetas de cofres para transiciones sin salto de layout.
* Normalización canónica de catálogo de cofres (#17):
  - Fechas de lanzamiento formateadas con padding estricto `YYYY-MM-DD` en scripts de siembra y preset.
  - Purgado de fechas de inserción espurias mediante fallback a época Unix (`1970-01-01 00:00:00`) en cajas sin fecha de mercado oficial.
* Auditoría y QA integral:
  - Verificación matemática y de cadencia acústica en `reelTickTimes` (#13) certificando la fidelidad con la ráfaga densa de CS2.
  - Sesión de QA interactiva en vivo con Orca Browser validando aperturas individuales, apertura 5x en lote y venta de items.
  - 382 pruebas unitarias en verde con Vitest y 0 errores en TypeScript y oxlint.

## [0.2.0] - 2026-10-11

### Agregado
* Rebranding completo a LuckHelx en layout, header, SEO, términos, privacidad y contratos de arquitectura.
* Paridad 1:1 con el mercado de CS2. Un dólar equivale a un punto de XP (100 unidades enteras en SQLite).
* Venta de skins a valor real de mercado en dólares y centavos.
* Costo oficial de llaves CS2 fijado en 2.49 XP (2.49 USD).
* Rebalanceo de 477 cajas de CS2 según cotización real de Steam. Snakebite y Fracture cuestan 0.25 XP, Kilowatt 0.65 XP, cápsulas 0.90 XP, paquetes souvenir 3.50 XP y el fallback general queda en 1.50 XP.
* Resiliencia de precios con fallback por categoría de rareza (común $0.50, rara $2.00, épica $15.00, legendaria $80.00, especial con estrella $120.00). El endpoint de venta ya no bloquea transacciones si Steam no cotiza una skin.
* Precios de referencia iniciales para 112 skins y cuchillos populares sembrados en SQLite.
* Ventana semanal Stale-While-Revalidate (7 días) para refrescar cotizaciones sin congelar la interfaz.
* HU-05: Case Battles 1v1 contra bot simulado. Apertura simultánea contra cinco bots, ruleta dual sincronizada, audio procedimental y reglas de ganador se lleva todo (o conservan sus drops en empate).
* HU-06: CS2 Premier Rating entre 1.000 y 35.000+ puntos. Calcula constancia semanal, racha activa y misiones diarias en siete bandas de color oficiales. Aplica decay progresivo tras más de dos días sin registrar actividad.
* Insignia PremierRatingBadge en el encabezado con barra de progreso accesible hacia el siguiente nivel.

### Limpieza y rendimiento
* Eliminados todos los emojis de la interfaz y los scripts. Se reemplazaron por vectores SVG.
* Aguja de la ruleta alineada con el centro exacto del ítem ganador y rebote elástico idéntico a CS2.
* Salto inmediato a 0ms en la animación de apertura cuando el sistema detecta prefers-reduced-motion.
* Integración del toolchain de Rust con oxlint y biome para análisis estático e imports ordenados.
* 237 pruebas unitarias en verde con Vitest y 31 rutas estáticas/dinámicas compiladas en Next.js.
