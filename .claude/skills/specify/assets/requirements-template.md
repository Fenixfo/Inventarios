# Requirements — {{FEATURE_NAME}}

- **Fecha:** {{YYYY-MM-DD}}
- **Estado:** Borrador | Aprobado
- **Origen:** {{brainstorm | requisito directo del usuario | otro}}

## 1. Contexto

Descripción breve del problema que resuelve esta feature y por qué existe. 2-4 oraciones. Si viene de un brainstorm previo, referenciar la sesión y las decisiones clave heredadas.

## 2. Actores

Quiénes interactúan con el sistema. Ej: *usuario final*, *administrador*, *sistema externo X*.

## 3. Alcance

**Dentro de alcance:**
- Punto 1
- Punto 2

**Fuera de alcance:**
- Punto 1 (con justificación breve si no es obvio)

## 4. Requisitos funcionales (EARS)

Cada requisito usa la notación EARS: `WHEN <condición o evento> THE SYSTEM SHALL <comportamiento esperado>`. Numerar `RF-1`, `RF-2`, etc. Un requisito por bullet — si necesitás "y", probablemente son dos.

- **RF-1.** WHEN {{condición}} THE SYSTEM SHALL {{comportamiento}}.
- **RF-2.** WHEN {{condición}} THE SYSTEM SHALL {{comportamiento}}.

*Ejemplo:*
- **RF-1.** WHEN el usuario ejecuta el script con un archivo CSV inexistente THE SYSTEM SHALL imprimir un error claro con la ruta y terminar con código de salida 1.

## 5. Requisitos no funcionales

Aspectos transversales: performance, seguridad, compatibilidad, usabilidad, mantenibilidad. Solo los que aplican — no rellenar por rellenar.

- **RNF-1.** {{Ej: El script debe procesar archivos de hasta 50k filas en menos de 5 segundos en una laptop estándar.}}

## 6. Criterios de aceptación

Lista verificable derivada de los requisitos. Cada criterio debe poder responderse con sí/no observando el sistema.

- [ ] {{Criterio 1}}
- [ ] {{Criterio 2}}

## 7. Suposiciones y dependencias

- Suposición: {{ej. el CSV siempre viene con encoding UTF-8}}
- Dependencia: {{ej. Python 3.10+ instalado}}

## 8. Preguntas abiertas

Cualquier cosa que quedó sin resolver y bloquea el diseño. Si esta sección no está vacía, no pases a `design.md` hasta cerrarlas.

- {{Pregunta}}
