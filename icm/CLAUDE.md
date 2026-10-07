# EStiri Squad Workspace — Pipeline ICM

Workspace de orquestación técnica para el refactor, pulido de audio, cinemática y hardening de EStiri.
Los subagentes operan sobre este pipeline estructurado: las carpetas determinan la secuencia, la jerarquía acota el contexto y los archivos registran el estado.

## Estructura del Workspace

| Carpeta | Propósito |
|---|---|
| `stages/` | Pipeline de ejecución en 4 etapas ordenadas |
| `_shared/` | Factory: reglas de arquitectura, principios de decisión y estándares inmutables |

## Ruteo por Eventos

| Evento | Siguiente paso | Compuerta de Aprobación |
|---|---|---|
| Inicio de auditoría | Leer `stages/01_diagnostico_y_auditoria/CONTEXT.md` | CEO aprueba `output/auditoria_inicial.md` |
| Auditoría aprobada | Leer `stages/02_diseno_y_especificacion/CONTEXT.md` | CEO aprueba `output/plan_ejecucion.md` |
| Plan aprobado | Despachar workers vía `stages/03_implementacion_workers/CONTEXT.md` | CEO aprueba `output/registro_cambios.md` |
| Implementación terminada | Ejecutar compuertas en `stages/04_verificacion_y_gates/CONTEXT.md` | CEO firma el cierre contra `GATES.md` |
| Consulta de estado | Escanear `stages/*/output/` | El estado es lo que físicamente existe en disco |

## Regla Maestra

Ningún subagente avanza a la etapa siguiente sin que el CEO (Usuario + Antigravity) haya validado el artefacto emitido en `output/`.
