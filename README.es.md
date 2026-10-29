# LuckHelx

[English](README.md) · **Español**

Convierte tus tareas diarias en experiencia (XP). Una IA (DeepSeek) evalúa la dificultad de cada tarea, y el XP acumulado se gasta en una tienda personal, en cajas de CS2 con probabilidades reales, contratos de trade-up o batallas 1v1 contra bots.

Es una aplicación de escritorio local empaquetada con Electron. No requiere cuentas ni backend en la nube: todo vive en un archivo SQLite en tu máquina.

## Stack técnico

* Next.js 14 (App Router, TypeScript) para frontend y endpoints API.
* Electron para distribuir la aplicación como binario de escritorio.
* better-sqlite3 como motor de base de datos local en disco (un archivo, un usuario).
* DeepSeek API para estimar XP por tarea con clave propia.
* Web Audio API nativo para síntesis procedimental de clics, fanfarrias y ruleta.
* Vitest para la suite de pruebas unitarias y de dominio.

## Puesta en marcha

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Ejecutar en modo escritorio (desarrollo):
   ```bash
   npm run electron:dev
   ```
   Abre una ventana de Electron conectada al servidor local de Next.js. La base de datos se crea automáticamente en `%APPDATA%/luckhelx/data.db` (en Windows) o la ruta de usuario correspondiente.

3. Configurar tu clave de DeepSeek:
   Al abrir la aplicación, ve a Ajustes y pega tu clave de API. Se guarda localmente en SQLite. `GET /api/settings` solo confirma si existe y nunca la expone en texto plano.

4. Ejecutar solo como aplicación web:
   Si prefieres probarla en el navegador sin Electron:
   ```bash
   npm run dev
   ```
   En este modo la base de datos se guarda en `.local/data.db`.

## Scripts disponibles

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo web (Next.js) |
| `npm run electron:dev` | Aplicación de escritorio en desarrollo |
| `npm run build` | Compilación de producción en Next.js |
| `npm run electron:build` | Genera el ejecutable portable de Windows |
| `npm test` | Ejecuta la suite de Vitest (237 pruebas) |
| `node csgo/build-cases.js` | Reconstruye `csgo/cs2-cases-preset.json` desde el catálogo de CS2 y consulta precios en Steam |
| `node csgo/seed-to-db.js` | Siembra cajas, skins y vínculos en SQLite mediante UPSERT idempotente |

## Mecánicas del sistema

1. El panel principal te recibe de inmediato sin pantallas de login.
2. Cada tarea ingresada se evalúa con DeepSeek para asignarle XP. Las descripciones idénticas usan caché local para evitar consultas repetidas a la API.
3. Al marcar una tarea como completada, el saldo de XP se incrementa de forma atómica en SQLite.
4. En el catálogo defines recompensas de tienda directa y cofres con apertura aleatoria.
5. El catálogo de cajas viene precargado con 477 cajas reales de CS2. Cada caja entrega únicamente las skins que le pertenecen en el juego oficial.
6. La economía replica el mercado de CS2: 1 USD equivale exactamente a 1.00 XP (100 unidades enteras). Las llaves oficiales cuestan 2.49 XP. El precio de cada caja sigue al Steam Market: las más baratas, como Snakebite y Fracture, cuestan 0.25 XP, y las raras o antiguas cuestan bastante más. Las cajas sin cotización activa en Steam toman un valor de respaldo de 1.50 XP.
7. Las probabilidades se calculan por categoría de rareza, no por objeto individual. La rareza se decide primero y luego se elige un arma al azar dentro de ese grupo. Los cuchillos y guantes tienen una probabilidad base del 1.5%.
8. Las skins obtenidas pueden conservarse en el inventario, venderse al 100% de su cotización de mercado, fusionarse en contratos de Trade-Up (10 armas del mismo grado por una superior) o apostarse en Case Battles 1v1 contra bots simulados.
9. Si una skin no tiene cotización en Steam, el sistema asigna un valor base garantizado por rareza (desde $0.50 para comunes hasta $120.00 para cuchillos y guantes), evitando bloqueos al vender.
10. El sistema calcula tu CS2 Premier Rating (de 1.000 a 35.000+ puntos) según la constancia de hábitos completados en una ventana móvil semanal, multiplicador de racha activa y misiones diarias. Si pasas más de dos días inactivo, el puntaje baja de forma controlada.

## Sonido de las cajas

Todos los sonidos se sintetizan con la Web Audio API, sin archivos de audio. La ruleta suena con un tick por cada celda que pasa por el marcador: la app resuelve de antemano la curva del giro y agenda los ticks en el reloj de audio, así que no se desfasan aunque el navegador pierda frames. El tono del tick baja a medida que frena. La duración del giro se ajusta en Ajustes.

Puedes presionar Escape o hacer clic durante el giro para saltar la animación. El drop se resuelve en el servidor de forma inmediata al iniciar el giro, por lo que saltar la cinemática no altera el resultado. Si tu sistema tiene activado `prefers-reduced-motion`, la animación se omite por completo (0ms).

## Diseño visual

La interfaz utiliza una estética de registro contable: las tareas son asientos de un libro diario, el XP es una moneda auditable y las recompensas son comprobantes sellados. Combina tonos de tinta cálida, verde musgo y latón, con tipografía Roboto Slab para títulos e IBM Plex Mono para cifras numéricas.

La sección de cajas de CS2 es la única excepción visual deliberada: adopta el fondo oscuro y los colores de rareza auténticos del juego para emular la experiencia de apertura original.

## Seguridad e integridad

* Un usuario local: no existen sesiones ni datos ajenos que proteger. La base de datos es un archivo local.
* Clave de DeepSeek resguardada en SQLite local; ningún endpoint público la expone.
* Toda mutación de saldo, canje de cofres, contrato de Trade-Up y Case Battle corre dentro de transacciones atómicas `db.transaction()` con validación de balance no negativo a nivel de SQL.
* Los registros en `redemptions`, `item_sales` y `case_battles` son inmutables. El historial no se modifica retrospectivamente.
