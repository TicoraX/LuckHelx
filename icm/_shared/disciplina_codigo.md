# Disciplina de Código y Arquitectura

Reglas obligatorias para todos los subagentes ejecutores:

## 1. Karpathy Guidelines
* Explicitar supuestos antes de codificar.
* Cambios estrictamente quirúrgicos: no formatear ni alterar código adyacente que funcione.
* Limpiar únicamente el código huérfano generado por los propios cambios.
* Verificar mediante evidencia reproducible (tests/builds/logs).

## 2. Ponytail (YAGNI & Laziness Disciplinada)
* Preguntarse primero si la abstracción debe existir.
* Aprovechar las capacidades nativas de la plataforma (CSS sobre JS, restricciones SQLite sobre lógica manual).
* Cero dependencias nuevas sin autorización expresa del CEO.

## 3. Thermos (Correctness & Maintainability)
* Aplicar Code Judo: simplificar drásticamente las bifurcaciones y cadenas condicionales.
* Respetar la regla de las 1.000 líneas: ningún archivo puede cruzar las 1.000 líneas de código.
* Cero fallbacks ciegos ni `try/catch` que oculten errores de invariantes o retornen datos mock ficticios.

## 4. Invariantes de Dominio de EStiri
* El saldo de XP siempre se manipula en centésimas enteras (`1 XP = 100 unidades`).
* Las probabilidades de las cajas de CS2 son por tier de rareza, nunca por ítem.
* Los registros históricos en `redemptions` son inmutables (el pasado no se reescribe).
