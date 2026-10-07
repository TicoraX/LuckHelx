# 04_verificacion_y_gates — Comprobación irrefutable y cierre de compuertas

Un trabajo: Ejecutar la suite completa de pruebas, validar builds de producción, auditar A11y y certificar el cumplimiento de GATES.md.

## Entradas
- Trabajo: `../03_implementacion_workers/output/registro_cambios.md`
- Trabajo: `GATES.md`
- Referencia: `../../_shared/disciplina_codigo.md`

NO cargar: Afirmaciones de éxito sin evidencia reproducible en terminal.

## Proceso
1. Ejecutar `npm test` para certificar que el 100% de las pruebas pasen sin regresiones.
2. Ejecutar `npm run build` para garantizar que la compilación de producción de Next.js y el tipado TypeScript sean impecables.
3. Verificar el soporte de accesibilidad y `prefers-reduced-motion`.
4. Registrar los resultados con comandos y salidas literales en `output/reporte_gates.md`.

## Salidas
- `output/reporte_gates.md`

## Compuerta de Aprobación (Human Check)
El CEO evalúa `output/reporte_gates.md` y autoriza el merge a `main` o cierre del sprint.
