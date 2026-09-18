---
name: plan-test-cases
description: "Genera un plan de test cases e2e a partir de un spec (requirements.md + design.md). Crea 3 test cases: 1 happy path y 2 casos de fallo. Guarda el plan en e2e-tests-plan.md dentro de la carpeta del spec. Disparadores: 'plan de tests', 'test cases', 'e2e plan', 'planificar tests', 'plan-test-cases'."
---

# Plan Test Cases

Lee un spec completo y genera un plan de 3 test cases end-to-end: 1 happy path y 2 casos de fallo.

<HARD-GATE>
NO escribas codigo de tests. NO modifiques requirements.md, design.md ni tasks.md. Solo generas el plan de test cases en `e2e-tests-plan.md`.
</HARD-GATE>

## Cuando aplica

- Despues de que la implementacion de un spec esta completa.
- El usuario quiere planificar tests e2e antes de generarlos.
- Dice "plan de tests", "test cases", "e2e plan", "planificar tests".

## Posicion en el workflow

**brainstorm -> specify -> planning-tasks -> ejecucion TDD -> verify-implementation -> plan-test-cases -> generate-tests -> healer**

## Proceso

### 1. Validar input

1. Buscar carpetas bajo `docs/specs/` que contengan `requirements.md` y `design.md`.
2. Si hay una sola feature, usarla.
3. Si hay multiples, preguntar al usuario cual usar.
4. Si no hay ninguna, indicar que primero corra `/specify`.

### 2. Leer el spec

1. Leer `requirements.md` — extraer todos los RFs y criterios de aceptacion.
2. Leer `design.md` — entender la arquitectura, interfaces, flujos de datos y manejo de errores.
3. Explorar la implementacion existente para entender el estado actual del proyecto.

### 3. Generar el plan

Crear exactamente **3 test cases**:

#### TC-1: Happy Path
- Debe cubrir el flujo principal de la aplicacion de punta a punta.
- Incluir multiples RFs en un solo flujo (ej: crear, listar, verificar que aparece).
- Debe ser el caso mas representativo del uso normal.

#### TC-2: Caso de fallo 1
- Cubrir un escenario de error con validaciones de entrada.
- Verificar que los mensajes de error son los correctos segun el spec.
- Verificar que el estado no se corrompe tras el error.

#### TC-3: Caso de fallo 2
- Cubrir un escenario de error diferente al TC-2.
- Puede ser un caso borde: datos inexistentes, estado vacio, input inesperado.
- Verificar el comportamiento de recuperacion.

### 4. Escribir el plan

Guardar en `{specPath}/e2e-tests-plan.md` con esta estructura:

```markdown
# Plan de Tests E2E — {nombre del spec}

- **Fecha:** {fecha}
- **Spec:** {ruta del spec}
- **Total test cases:** 3

## TC-1: {nombre descriptivo} (Happy Path)

**Objetivo:** {que se valida}
**RFs cubiertos:** RF-N, RF-M, ...

**Precondiciones:**
- {estado inicial necesario}

**Pasos:**
1. {accion concreta}
2. {accion concreta}
...

**Resultado esperado:**
- {assertion verificable}

---

## TC-2: {nombre descriptivo} (Fallo)

{misma estructura}

---

## TC-3: {nombre descriptivo} (Fallo)

{misma estructura}
```

### 5. Confirmar al usuario

Mostrar un resumen de los 3 test cases generados y preguntar si quiere proceder a generar los tests (invocar subagente `generate-tests`).

## Reglas

- Exactamente 3 test cases: 1 happy path + 2 fallos. No mas, no menos.
- Cada test case debe referenciar los RFs que cubre.
- Los pasos deben ser concretos y ejecutables, no genericos.
- Los resultados esperados deben ser verificables con assertions.
- NO generar codigo. Solo el plan en markdown.
- El plan debe ser suficiente para que el subagente `generate-tests` pueda generar los tests sin ambiguedad.
