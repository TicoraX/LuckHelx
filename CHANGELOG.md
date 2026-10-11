# Changelog — LuckHelx

Todas las modificaciones notables de este proyecto están documentadas en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y cumple con [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-10-11

### 🚀 Novedades y Características Principales
* **Rebranding Oficial a LuckHelx**:
  * Unificación de identidad de marca en Header, Layout, metadatos SEO/OpenGraph, JSON-LD, páginas legales (Términos y Privacidad) y contratos de arquitectura ICM.
* **Paridad Económica 1:1 con CS2**:
  * **Equivalencia monetaria**: $1.00 USD de mercado equivale a 1.00 XP (100 unidades enteras en SQLite), erradicando errores de coma flotante.
  * **Venta al 100% de mercado**: Las skins se venden directamente a su cotización real en dólares y centavos.
  * **Llaves oficiales de CS2**: Costo de llave calibrado a 2.49 XP ($2.49 USD, precio oficial de Valve).
  * **Rebalanceo de 477 Cajas**: Cajas populares mapeadas a sus centavos de mercado (ej. *Snakebite* y *Fracture* a 0.25 XP, *Revolution* a 0.35 XP, *Kilowatt* a 0.65 XP, *Dreams & Nightmares* a 0.95 XP; cápsulas a 0.90 XP; paquetes souvenir a 3.50 XP; fallback a 1.50 XP).
* **Resiliencia de Precios (Zero-Fail Guarantee)**:
  * Sistema de precios de tres capas con fallback determinista por rareza:
    * Común: $0.50 USD
    * Rara: $2.00 USD
    * Épica: $15.00 USD
    * Legendaria: $80.00 USD
    * Especial (★ Cuchillos / Guantes): $120.00 USD
  * Erradicado el error 400 por falta de precio en ventas de inventario.
  * Política Stale-While-Revalidate a 7 días sin bloquear la experiencia de usuario.
  * Siembra inicial de 112 precios de mercado de CS2 en SQLite.
* **HU-05: Case Battles 1v1 contra Bot Simulado**:
  * Batallas de apertura simultánea contra 5 bots tácticos (*Lord Gaben*, *Clucky*, *Neo-Sniper*, *Jarvis AI*, *Boris Rush-B*).
  * Cinemática dual reel sincronizada con físicas Web Audio y transacciones atómicas SQLite.
  * Lógica de ganador por mayor valor acumulado (se lleva ambos drops) y preservación individual en empate.
* **HU-06: CS2 Premier Rating & Habit Decay**:
  * Rating de 1,000 a 35,000+ pts derivado de consistencia en tareas, racha activa y misiones diarias.
  * 7 bandas de color oficiales de CS2 (Gris, Celeste, Azul, Violeta, Rosa, Rojo, Dorado).
  * Mecánica de Habit Decay tras > 2 días de inactividad para incentivar la recurrencia con piso calibrado.
  * Componente `PremierRatingBadge` en Header con tooltip semántico y barra de progreso.

### 🎨 Diseño y Accesibilidad
* Purga total de emojis Unicode en UI y scripts, sustituidos por vectores SVG limpios.
* Calibración milimétrica de la aguja central y retroceso elástico en ruleta de cajas.
* Bypass instantáneo (0ms) en animaciones ante `prefers-reduced-motion: reduce`.

### 🛠️ Toolchain y Calidad
* Integración con herramientas de alto rendimiento en Rust (`oxlint` para análisis estático y `biome` para formateo estricto e imports ordenados alfabéticamente).
* 237 pruebas unitarias de Vitest pasando al 100%.
* 31 rutas estáticas y dinámicas compiladas limpiamente en Next.js.
