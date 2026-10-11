# Changelog: LuckHelx

Historial de cambios notables de LuckHelx. Formato basado en Keep a Changelog y Semantic Versioning.

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
