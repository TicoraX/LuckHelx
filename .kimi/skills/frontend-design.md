---
name: frontend-design
description: Usar antes de generar o tocar cualquier UI. Bloquea el sistema de diseño primero para que N pantallas se vean como un producto, no como N productos.
---

Proceso obligatorio, en orden:

1. BRAINSTORM (no código todavía): define en una frase la dirección visual concreta ("qué referencia, qué sensación"). Vago ("moderno, limpio") = resultado template. Debe ser específico al punto de excluir claramente dos alternativas.
2. TOKENS, y para ahí: paleta con 4-6 hex nombrados; tipografía (una display con carácter usada con moderación + una de texto + opcional una utilitaria para datos/captions); layout como concepto de una frase + wireframe ASCII; UNA firma visual (el elemento único por el que se recordaría esta pantalla).
3. AUTOCRÍTICA antes de tocar código: compara tu propuesta contra estos 3 clusters que TODA IA generativa produce por defecto — (a) fondo crema cálido ~#F4F1EA + serif de alto contraste + acento terracota, (b) fondo casi negro + un solo acento verde-ácido o bermellón brillante, (c) layout tipo periódico con hairline rules, cero border-radius, columnas densas. Si tu propuesta cae en alguno de estos sin una razón específica del producto, descártala y vuelve al paso 1.
4. Construye 3 primitivos (botón, input, contenedor) antes de cualquier pantalla completa. Toda pantalla los compone; si "necesita" un cuarto primitivo, ese primitivo falta en el sistema — agrégalo al sistema, no lo hagas inline.
5. Genera pantallas referenciando los tokens por nombre. Cero hex crudo, cero tamaños de fuente sueltos, cero excepciones "solo esta vez".

Reglas duras (aprendidas de errores reales en este mismo proyecto — no las repitas):

- CERO emojis como iconos de UI (nav, botones, badges, toasts). Usa SVG propios, simples, stroke-based, coherentes en grosor de trazo.
- CERO glassmorphism/glow decorativo (backdrop-blur + box-shadow con rgba de color brillante) a menos que sea LA firma visual elegida a propósito, no un default.
- CERO nombre de marca inventado o arbitrario en el header/login/footer. Si el producto no tiene nombre decidido, usa algo genérico neutro o nada.
- CERO footer corporativo genérico ("Powered by AI", copyright, taglines de marketing) que nadie pidió.
- CERO copy con signos de exclamación en cascada, MAYÚSCULAS para énfasis, o tono "hype" de app gamificada genérica ("¡¡FELICIDADES!!", "¡SUBISTE DE NIVEL!!"). Tono directo, en minúsculas naturales del español, sin gritar.
- El movimiento es una decisión, no decoración: una sola curva de easing y duración para todo el producto, o nada se mueve.
- Claro y oscuro son el MISMO diseño con los mismos tokens en valores distintos, no dos diseños.
- Accesibilidad no es un pase de pulido: contraste y focus-visible se deciden en el paso 2 (tokens), no se parchan al final.
