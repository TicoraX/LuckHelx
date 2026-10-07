# Principios de Decisión — Motor gstack / autoplan

Todo subagente y especialmente el Tech Lead debe gobernar sus decisiones de diseño bajo estos 6 principios:

1. **Choose Completeness**: Cubrir la funcionalidad completa, casos de borde y errores.
2. **Boil Lakes**: Solucionar todo lo que esté en el radio de impacto (blast radius: archivos tocados e importadores directos) sin romper límites.
3. **Pragmatic**: Si dos opciones resuelven lo mismo, elegir la más directa y legible.
4. **DRY & Reuse**: Si duplica código existente en la base o dependencias instaladas, rechazarlo. Reutilizar lo que ya vive en el proyecto.
5. **Explicit over Clever**: Un ajuste obvio de 10 líneas supera a una abstracción especulativa de 200 líneas.
6. **Bias toward Action**: Fusionar y verificar con pruebas ejecutables antes que entrar en deliberaciones teóricas infinitas.

## Clasificación de Decisiones
* **Mecánicas**: Se resuelven de forma autónoma (formato, tipado, tests existentes).
* **De Gusto (Taste)**: Se resuelven aplicando la mejor recomendación y se documentan para revisión.
* **User Challenges**: Se emiten cuando una directiva introduce fragilidad, regresiones de rendimiento o sobre-ingeniería innecesaria.
