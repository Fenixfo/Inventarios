---
name: verify-implementation
description: "Loop autonomo de verificacion e2e que se dispara al terminar la implementacion. Orquesta el ciclo: verificar implementacion -> planificar tests -> generar tests -> ejecutar y diagnosticar. Disparadores: 'verificar implementacion', 'verify implementation', 'loop e2e', 'verificacion e2e', 'e2e loop'."
---

# Verify Implementation — Loop E2E

Orquesta el ciclo autonomo de verificacion end-to-end. Se dispara una vez que la implementacion de un spec esta completa.

<HARD-GATE>
NO modifiques requirements.md, design.md ni tasks.md. Este skill solo orquesta la verificacion — no modifica el spec.
</HARD-GATE>

## Cuando aplica

- La implementacion de un spec esta completa (todas las tareas done, tests unitarios pasan).
- El usuario quiere validar la implementacion con tests e2e.
- Dice "verificar implementacion", "loop e2e", "verificacion e2e", "e2e loop", "verify implementation".

## Posicion en el workflow

**brainstorm -> specify -> planning-tasks -> ejecucion TDD -> verify-implementation -> [loop e2e]**

Este skill es el puente entre la implementacion y la verificacion final.

## Proceso

### Paso 1: Verificar que la implementacion esta completa

1. Buscar el spec (bajo `docs/specs/`). Si hay multiples, preguntar al usuario.
2. Leer `tasks.md` — verificar que todas las tareas estan en estado `completada`.
3. Correr los tests unitarios del proyecto y verificar que pasan.
4. Si hay tareas pendientes o tests fallando, **detenerse** e informar al usuario. No continuar al loop e2e hasta que la implementacion base este solida.

### Paso 2: Planificar test cases (skill plan-test-cases)

1. Leer `requirements.md` y `design.md` del spec.
2. Generar el plan de 3 test cases e2e (1 happy path + 2 fallos) y guardarlo en `{specPath}/e2e-tests-plan.md`.
3. Seguir las reglas del skill `plan-test-cases` para la estructura del plan.

### Paso 3: Generar tests (subagente generate-tests)

Invocar el subagente `generate-tests` con Agent tool:

```
Agent(subagent_type: "generate-tests", prompt: "...")
```

El subagente debe:
- Leer `e2e-tests-plan.md` del spec.
- Generar los archivos de test en la carpeta `e2e/`.
- Reportar los archivos creados.

### Paso 4: Ejecutar y diagnosticar (subagente healer)

Invocar el subagente `healer` con Agent tool:

```
Agent(subagent_type: "healer", prompt: "...")
```

El subagente debe:
- Correr los tests generados.
- Analizar los resultados.
- Generar `{specPath}/e2e-tests-report.md` con el diagnostico.

### Paso 5: Evaluar reporte y decidir

1. Leer `e2e-tests-report.md` generado por el healer.
2. Evaluar el resultado:

**Si todos los tests PASAN:**
- Informar al usuario que la verificacion e2e esta completa.
- El loop termina.

**Si hay fallos clasificados como `TEST_DEFECT`:**
- Los tests tienen errores, no el codigo.
- Informar al usuario y sugerir re-generar los tests (volver al Paso 3).

**Si hay fallos clasificados como `CODE_DEFECT`:**
- El codigo no cumple con el spec.
- Informar al usuario con los defectos encontrados y los RFs afectados.
- Sugerir corregir el codigo y volver a correr el loop.

**Si hay `BLOCKED`:**
- Problema de entorno o configuracion.
- Informar al usuario y detenerse.

### Paso 6: Presentar resultado final

Mostrar al usuario:
- Tabla resumen: tests ejecutados, pasan, fallan, bloqueados.
- Clasificacion de fallos (TEST_DEFECT / CODE_DEFECT / ENVIRONMENT / FLAKY).
- Recomendaciones de accion.
- Si el loop debe continuar o si la verificacion esta completa.

## Archivos involucrados

| Archivo | Quien lo crea | Quien lo lee |
|---|---|---|
| `e2e-tests-plan.md` | Paso 2 (plan-test-cases) | generate-tests |
| `e2e/*.spec.*` | generate-tests | healer |
| `e2e-tests-report.md` | healer | Paso 5 (evaluacion) |

## Reglas

- NO modificar tests unitarios existentes. Este loop es para tests e2e adicionales.
- NO modificar la implementacion directamente. Solo diagnosticar y reportar.
- El healer NUNCA modifica tests ni codigo — solo reporta.
- El generate-tests NUNCA modifica codigo de implementacion — solo genera tests.
- Si el loop necesita repetirse, informar al usuario antes de re-ejecutar.
- Maximo 3 iteraciones del loop sin intervencion del usuario. Si despues de 3 rondas sigue fallando, detenerse y pedir decision.
