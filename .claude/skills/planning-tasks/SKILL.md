---
name: planning-tasks
description: "Validar input y lanzar el workflow converge-tasks para iterar tasks.md contra un spec. Disparadores: 'planificar', 'refinar tareas', 'evaluar tareas', 'planning', 'iterar el plan', 'planning-tasks'."
---

# Planning Tasks

Valida que exista un spec completo y lanza el workflow `converge-tasks` para iterar `tasks.md`.

<HARD-GATE>
NO escribas código, NO crees tests, NO modifiques requirements.md ni design.md. Solo validá el input y lanzá el workflow.
</HARD-GATE>

## Cuándo aplica

- El usuario quiere refinar/validar las tareas de un spec existente.
- Viene de `/specify` y quiere iterar el plan antes de implementar.
- Dice "planificar", "refinar tareas", "evaluar tareas", "planning", "iterar el plan".

## Posición en el workflow

**brainstorm → specify → planning-tasks → ejecución TDD → verificación → commit**

## Proceso

### 1. Validar input

1. Buscar carpetas bajo `docs/specs/` que contengan `requirements.md` y `design.md`.
2. Si hay una sola feature, usarla.
3. Si hay múltiples, preguntar al usuario cuál iterar.
4. Si no hay ninguna, indicar que primero corra `/specify`.

### 2. Lanzar workflow

```
Workflow(name: "converge-tasks", args: "{ruta-del-spec}")
```

Informar al usuario que el planning está en ejecución.

### 3. Presentar resultados

Cuando el workflow termine, mostrar:

- Tabla de veredictos por tarea (APROBADA, MODIFICAR, DIVIDIR, FUSIONAR, DESCARTAR, NUEVA)
- Cobertura de RFs: `{rfsCovered}/{totalRfs}`
- Si hay gaps, advertir

### 4. Handoff

- **No codear.** La implementación es el paso siguiente.
- **No invocar otros skills.** Devolver el control al usuario.

## Qué hace el workflow `converge-tasks`

El skill no orquesta agentes — eso lo hace el workflow en 4 fases:

1. **Scout** — lee el spec, extrae RFs y tareas, determina modo (from_scratch / iterative)
2. **Plan** — fan-out de N planners read-only en paralelo, cada uno emite un veredicto estructurado
3. **Reduce** — JS puro: clasifica veredictos, detecta conflictos, verifica cobertura
4. **Write** — un único agente aplica todos los cambios atómicamente en tasks.md
