# EStiri Squad Pipeline — Contrato de Orquestación

Flujo en una línea: Diagnosticar objetivamente, diseñar quirúrgicamente, implementar en squad especializado y verificar con compuertas irrefutables.

| Etapa | Responsabilidad | Entrada | Salida | Compuerta de Aprobación |
|---|---|---|---|---|
| `01_diagnostico_y_auditoria` | Mapeo integral de código y cuellos de botella | Código base + `_shared/` | `output/auditoria_inicial.md` | CEO valida alcance y hallazgos |
| `02_diseno_y_especificacion` | Plan de microinteracciones, audio y backend | `01/.../auditoria_inicial.md` | `output/plan_ejecucion.md` | CEO aprueba tareas y boundaries |
| `03_implementacion_workers` | Ejecución por los 4 Workers especializados | `02/.../plan_ejecucion.md` | `output/registro_cambios.md` | CEO revisa diffs quirúrgicos |
| `04_verificacion_y_gates` | Pruebas reales, A11y y suites Vitest | `03/.../registro_cambios.md` | `output/reporte_gates.md` | CEO valida cumplimiento de GATES.md |

Factory (inmutable): `_shared/{principios_gstack.md, disciplina_codigo.md, estandares_ui_audio.md}`
Product (por ciclo): `stages/*/output/`

El estado del sistema se deduce físicamente: una etapa está COMPLETA únicamente cuando su carpeta `output/` contiene su respectivo artefacto verificado.
