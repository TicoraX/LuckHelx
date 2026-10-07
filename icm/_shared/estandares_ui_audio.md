# Estándares de UI, Animación y Audio

## 1. Animaciones y Microinteracciones (Emil Kowalski / Deliberate)
* **Nunca animar desde `scale(0)`**: Los elementos físicos no surgen de la nada. Usar `transform: scale(0.95); opacity: 0;`.
* **Prohibido `transition: all`**: Declarar siempre las propiedades explícitas (`transition: transform 160ms ease-out, opacity 160ms ease-out;`).
* **Respuesta física en `:active`**: Todo elemento interactivo debe tener `:active { transform: scale(0.97); }`.
* **Curvas intencionales**: Evitar curvas por defecto. Usar `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` para UI ágil.
* **Duración**: Las interacciones de UI deben completarse en $\le 300\text{ ms}$.
* **Respeto a A11y**: Integrar soporte incondicional para `@media (prefers-reduced-motion: reduce)`.

## 2. Audio Procedimental y Sincronización (Web Audio API)
* Cero dependencias externas de audio. Toda síntesis se realiza mediante `AudioContext` nativo del navegador.
* **Respeto a volumen maestro**: Toda ganancia procedural (`gainNode.gain`) debe multiplicarse por `this.volume`.
* **Sincronización cinemática**: La detección de cruce de celda en el carrete debe basarse en la transformación matricial pintada por el navegador (`DOMMatrixReadOnly(getComputedStyle(el).transform).m41`) dentro de un bucle `requestAnimationFrame`.
* **Fallback transparente**: Si el sample oficial `.mp3` no está disponible, conmutar inmediatamente a los ticks sintetizados sin bloquear la animación visual.
