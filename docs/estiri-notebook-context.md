# Contexto del Proyecto EStiri (Sistema de Recompensas Gamificado)

Este documento sirve como fuente de verdad y contexto rápido para alimentar a Gemini (en un hilo de chat o en NotebookLM) y mantener las ideas organizadas sobre el desarrollo de EStiri.

---

## 1. Mapa de Estructura del Proyecto

```
a:/Proyectos/EStiri
├── app/                              # Rutas del Next.js App Router
│   ├── api/                          # Endpoints locales de la API
│   │   ├── backup/                   # GET/POST para respaldos JSON
│   │   ├── ledger/                   # GET para el estado de cuenta
│   │   ├── redeem/                   # POST para canjes de recompensas
│   │   ├── rewards/                  # GET/POST/PATCH/DELETE de recompensas
│   │   ├── settings/                 # GET/POST clave DeepSeek
│   │   ├── state/                    # GET balance XP y tareas
│   │   └── tasks/                    # Rutas API de tareas
│   │       ├── complete/             # POST completado de tarea
│   │       ├── create/               # POST creación de tarea
│   │       └── [id]/                 # DELETE borrado de tarea
│   ├── ledger/                       # Vista de Estado de Cuenta
│   │   └── page.tsx
│   ├── rewards/                      # Vista de Recompensas (Tienda, Cofres)
│   │   └── page.tsx
│   ├── globals.css                   # Sistema de diseño, tokens CSS y variables
│   ├── layout.tsx                    # Layout raíz (manejo de no-flash y suppressHydrationWarning)
│   └── page.tsx                      # Dashboard principal (Tareas activas)
│
├── components/                       # Componentes React reutilizables
│   ├── AchievementsModal.tsx         # Modal de logros gamificados
│   ├── AnimatedNumber.tsx            # Contador animado de XP
│   ├── ChestReel.tsx                 # Ruleta visual de premios
│   ├── Confetti.tsx                  # Partículas de confeti en lienzo canvas
│   ├── ConfirmModal.tsx              # Confirmaciones atómicas/destructivas
│   ├── FadeIn.tsx                    # Contenedor con animación de entrada
│   ├── Header.tsx                    # Cabecera principal (Nav, Toggles)
│   ├── HelpModal.tsx                 # Guía interactiva de funcionamiento
│   ├── Icons.tsx                     # Iconografía vectorial SVG pura (Phosphor/Lucide)
│   ├── MobileNav.tsx                 # Barra inferior móvil para pantallas pequeñas
│   ├── SettingsModal.tsx             # Ajustes de clave API y sección de respaldo
│   ├── SoundToggle.tsx               # Conmutador de efectos de sonido
│   ├── StreakBadge.tsx               # Indicador visual de racha de días activos
│   ├── ThemeToggle.tsx               # Conmutador de tema oscuro/claro
│   ├── Toast.tsx                     # Sistema de notificaciones emergentes
│   └── XpProgressBar.tsx             # Barra de nivel y progreso de XP
│
├── docs/                             # Documentación de diseño y especificaciones
│   ├── superpowers/
│   │   ├── plans/
│   │   └── specs/
│   │       ├── 2026-07-19-electron-local-migration-design.md
│   │       └── ledger-direction.md
│   └── estiri-notebook-context.md    # Este archivo de contexto
│
├── electron/                         # Código de empaquetado de escritorio
│   └── main.js                       # Configuración e inicio de ventana de Electron
│
├── lib/                              # Lógica de negocio (SQLite local, DeepSeek)
│   ├── db.ts                         # Conector better-sqlite3 y migraciones de DB
│   ├── deepseek.ts                   # Cliente API de DeepSeek para evaluar XP
│   ├── rewards-store.ts              # Gestión de recompensas en SQLite
│   ├── tasks-store.ts                # Gestión de tareas en SQLite
│   ├── settings-store.ts             # Almacén de clave API local
│   ├── backup.ts                     # Funciones de respaldo y restauración
│   ├── sound.ts                      # Sintetizador nativo Web Audio API (sin archivos de audio)
│   ├── streak.ts                     # Algoritmo de cálculo de racha diaria
│   ├── sync.ts                       # Caché de XP por descripción de tarea
│   └── *.test.ts                     # Pruebas unitarias de lógica con Vitest
│
├── public/                           # Recursos estáticos
├── scripts/                          # Scripts de soporte y pruebas de humo
├── package.json                      # Scripts de compilación y dependencias
├── tsconfig.json                     # Configuración de TypeScript
└── vitest.config.ts                  # Configuración del entorno de tests
```

---

## 2. Puntos Clave de la Arquitectura

1. **Local-First & Offline**:
   - Todo se almacena localmente en una base de datos **SQLite** (`better-sqlite3`).
   - No hay autenticación en la nube, bases de datos externas ni servidores compartidos.
   - En desarrollo web normal se crea en `.local/data.db`. En la app empaquetada de Electron se ubica en el directorio de datos del usuario (`app.getPath('userData')`).

2. **Evaluación de XP con Inteligencia Artificial**:
   - Cada tarea creada se envía de forma segura al endpoint local. Este hace una llamada a la API de **DeepSeek** utilizando la clave del usuario (guardada localmente en la base de datos).
   - Se incluye un mecanismo de caché (`sync.ts`) para que las tareas repetidas o con descripciones similares devuelvan el valor de XP previamente calculado de forma instantánea, ahorrando llamadas de API.

3. **Identidad Visual "Libro de Cuentas" (Ledger)**:
   - **Tono y Estilo**: Tinta cálida (`#23201a`/`#ece5d6`), verde musgo (`#7d8f6a`), oro latón para el XP (`#c99a3a`). Esquinas rectas (`border-radius: 4px`).
   - **Estructura**: Cero tarjetas flotantes genéricas. Todo se visualiza en renglones de libro mayor (`.ledger-sheet`, `.ledger-head`, `.ledger-row`).
   - **Tipografía**: Títulos e indicaciones con *Roboto Slab* y valores tabulares numéricos (XP, Costos, Fechas) con *IBM Plex Mono* (`font-variant-numeric: tabular-nums`).

4. **Sintetizador Web Audio API (`lib/sound.ts`)**:
   - Generación de sonidos en tiempo real directamente en el cliente (clic de botón, completado de tarea, apertura de cofre, subida de nivel). No requiere archivos `.mp3` ni `.wav`.

---

## 3. Pruebas y Comandos Útiles

* **Modo de desarrollo local (Web)**: `npm run dev`
* **Modo de desarrollo en Escritorio (Electron)**: `npm run electron:dev`
* **Ejecutar Pruebas Unitarias (Vitest)**: `npm test -- --run`
* **Compilación de Producción (Next.js)**: `npm run build`
* **Empaquetar aplicación para Windows (`.exe` portable)**: `npm run electron:build`
