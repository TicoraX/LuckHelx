# 01_diagnostico_y_auditoria — Mapear el estado técnico actual

Un trabajo: Inspeccionar el código fuente del carrete, motor de audio, microinteracciones y rutas de datos para documentar hallazgos y oportunidades de mejora.

## Entradas
- Trabajo: `lib/sound.ts`, `components/ChestReel.tsx`, `components/*.tsx`, `app/globals.css`, `app/api/**`
- Referencia: `../../_shared/principios_gstack.md`
- Referencia: `../../_shared/disciplina_codigo.md`
- Referencia: `../../_shared/estandares_ui_audio.md`

NO cargar: Planes anteriores obsoletos ni suposiciones no verificadas contra el código real.

## Proceso
1. Inspeccionar `lib/sound.ts` para verificar la calibración de volumen y síntesis de osciladores.
2. Inspeccionar `components/ChestReel.tsx` para evaluar la sincronización de audio con el `requestAnimationFrame` y curvas de easing.
3. Evaluar los componentes en `components/` buscando transiciones genéricas (`all`), falta de feedback en `:active` o modales apareciendo desde `scale(0)`.
4. Evaluar las rutas de backend en `app/api/` y transacciones en `lib/` para verificar atomicidad de saldos de XP.

## Salidas
- `output/auditoria_inicial.md`

## Compuerta de Aprobación (Human Check)
El CEO revisa `output/auditoria_inicial.md`, valida la lista de problemas detectados y confirma si el diagnóstico es completo y certero antes de autorizar la fase 2.
