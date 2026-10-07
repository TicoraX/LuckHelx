# 03_implementacion_workers — Ejecución quirúrgica por squad especializado

Un trabajo: Aplicar los cambios de código especificados en el plan mediante los 4 workers, manteniendo los diffs minimalistas y verificables.

## Entradas
- Trabajo: `../02_diseno_y_especificacion/output/plan_ejecucion.md`
- Referencia: `../../_shared/disciplina_codigo.md`
- Referencia: `../../_shared/estandares_ui_audio.md`

NO cargar: Refactorizaciones no solicitadas en código adyacente.

## Proceso
1. Worker 1 aplica las mejoras de animación en `ChestReel.tsx`, modales y botones en `globals.css` / componentes.
2. Worker 2 ajusta `lib/sound.ts` para balancear las ganancias con el volumen maestro y optimizar la sincronización acústica del carrete.
3. Worker 3 blinda las mutaciones de datos en `lib/` y rutas API asegurando atomicidad sin dependencias nuevas.
4. Worker 4 redacta pruebas unitarias o de integración según TDD para cada comportamiento modificado.

## Salidas
- `output/registro_cambios.md`

## Compuerta de Aprobación (Human Check)
El CEO inspecciona el `git diff` y `output/registro_cambios.md` para confirmar que los cambios son quirúrgicos y libres de efectos secundarios.
