# CLAUDE.md — Guía para trabajo con Claude

## Flujo de trabajo del proyecto

Este proyecto sigue un flujo estructurado para construir features:

```
brainstorm → specify → planning-tasks → implementación → verify-implementation → commit
```

### 1. Brainstorming (`/brainstorming`)
**Qué es**: Clarificar la idea mediante diálogo.
- El skill hace preguntas para entender el problema.
- Se proponen 2-3 enfoques con trade-offs.
- El usuario aprueba el diseño verbalmente.
- **Output**: Diseño aprobado en el contexto (no hay archivos).

**Cuándo termina**: El usuario dice "sí, adelante con esto".

---

### 2. Especificación (`/specify`)
**Qué es**: Materializar el diseño en 3 documentos formales.
- Lee el contexto del brainstorm (no repreguntar).
- Genera `requirements.md` (notación EARS).
- Genera `design.md` (arquitectura y contratos).
- Genera `tasks.md` (plan de implementación).
- Cada documento pasa approval gate antes de continuar.

**Archivos creados**: `docs/specs/<slug>/{requirements.md, design.md, tasks.md}`

**Cuándo termina**: Los 3 archivos están aprobados.

---

### 3. Planificación de tareas (`/planning-tasks`)
**Qué es**: Validar y refinar `tasks.md` contra el spec.
- Lanza el workflow `converge-tasks` en 4 fases:
  - Scout: extrae RFs y tareas.
  - Plan: múltiples `planner` agents evalúan en paralelo.
  - Reduce: analiza veredictos.
  - Write: un agent consolida cambios.

**Archivos modificados**: `docs/specs/<slug>/tasks.md` (iterado hasta 100% cobertura de RFs).

**Cuándo termina**: Todas las tareas APROBADAS, 100% de RFs cubiertos.

---

### 4. Implementación
**Qué es**: Tu código aquí.
- Sigue las tareas de `tasks.md`.
- Escribe tests unitarios mientras avanzas (TDD).
- Actualiza el log de decisiones en cada tarea.
- Marca tareas como "completada" cuando termines.

**Archivos modificados**: Tu código + `docs/specs/<slug>/tasks.md` (log de decisiones).

**Cuándo termina**: Todas las tareas en estado "completada", tests pasan.

---

### 5. Verificación E2E (`/verify-implementation`)
**Qué es**: Orquesta tests e2e automáticos.
- Verifica que todas las tareas estén completadas.
- Genera plan de 3 test cases (1 happy path + 2 fallos).
- Genera tests automáticamente (subagente `generate-tests`).
- Ejecuta y diagnostica (subagente `healer`).

**Archivos generados**:
- `docs/specs/<slug>/e2e-tests-plan.md`
- `e2e/` (test files)
- `docs/specs/<slug>/e2e-tests-report.md`

**Cuándo termina**: Todos los tests e2e pasan (PASS) o se resuelven bloqueadores.

---

### 6. Commit
**Qué es**: Versionar todo.
- Commit de tu código con mensaje descriptivo.
- Todos los specs, tareas y tests están en git.

---

## Estructura de carpetas

```
Inventarios/
├── README.md                  ← Comienza aquí
├── CLAUDE.md                  ← Este archivo
├── .claude/
│   ├── settings.local.json
│   ├── agents/
│   │   ├── planner.md
│   │   ├── task-verifier.md
│   │   ├── healer.md
│   │   └── generate-tests.md
│   ├── skills/
│   │   ├── brainstorming/SKILL.md
│   │   ├── specify/SKILL.md (+ assets/)
│   │   ├── planning-tasks/SKILL.md
│   │   ├── plan-test-cases/SKILL.md
│   │   └── verify-implementation/SKILL.md
│   └── workflows/
│       └── converge-tasks.js
├── docs/
│   └── specs/
│       ├── <feature-1>/
│       │   ├── requirements.md
│       │   ├── design.md
│       │   ├── tasks.md
│       │   ├── e2e-tests-plan.md
│       │   └── e2e-tests-report.md
│       └── <feature-2>/
│           └── (igual estructura)
└── e2e/                       ← Tests Playwright generados
    └── test-*.spec.ts
```

---

## Convenciones

### Nombres de features (slugs)
- snake_case corto y descriptivo.
- Ejemplo: `agregar_producto`, `reportes_mensuales`, `autenticacion_oauth`.

### Notación EARS para requisitos
```
WHEN <condición o evento> THE SYSTEM SHALL <comportamiento esperado>
```

Ejemplo:
```
WHEN el usuario agrega un producto con cantidad 0
THE SYSTEM SHALL mostrar un error "La cantidad debe ser mayor a 0"
```

### Requisitos vs. diseño
- **requirements.md**: QUÉ (vive más tiempo, más estable).
- **design.md**: CÓMO (puede cambiar sin afectar RFs).

### Log de decisiones
En `tasks.md`, cada tarea tiene un log donde registrar decisiones tomadas durante la implementación:

```markdown
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-09-18 | Usar Redis para caché en lugar de BD | Performance tests mostraban bottleneck en queries |
```

### Tests
- **Unitarios**: Durante implementación (TDD).
- **E2E**: Después de terminar todas las tareas (`/verify-implementation`).

---

## Comandos disponibles

| Comando | Cuándo usarlo |
|---------|---------------|
| `/brainstorming` | Tienes una idea vaga, necesitas clarificar |
| `/specify` | Después de brainstorming, para formalizar en docs |
| `/planning-tasks` | Después de `/specify`, para validar tareas |
| `/plan-test-cases` | Después de implementar, para planificar tests e2e |
| `/verify-implementation` | Después de implementar, para correr tests automáticos |

---

## Reglas importantes

### NO hagas
- ❌ Brainstorming sin documentarlo después (`/specify`).
- ❌ Pasar `/specify` sin approval gates (3 puertas: requirements, design, tasks).
- ❌ Implementar sin tener `tasks.md` aprobado.
- ❌ Hacer commit sin pasar tests e2e.
- ❌ Modificar `requirements.md` o `design.md` después de aprobados sin actualizar `tasks.md`.

### SÍ haz
- ✅ Usar EARS estricto en requirements.
- ✅ Mapear cada tarea a RFs del spec.
- ✅ Actualizar el log de decisiones en cada tarea.
- ✅ Correr `/planning-tasks` si el plan inicial no cierra al 100%.
- ✅ Usar `/verify-implementation` para validar antes de mergear.

---

## Referencia rápida: Qué hace cada agente

| Agente | Lee | Escribe | Veredictos | Cuándo |
|--------|------|---------|-----------|--------|
| **planner** | `requirements.md`, `design.md`, `tasks.md` | (nada) | APROBADA, MODIFICAR, DIVIDIR, FUSIONAR, DESCARTAR, NUEVA | `/planning-tasks` lanza paralelo |
| **task-verifier** | tests, `tasks.md`, `requirements.md` | (nada) | PASS, FAIL, INCONCLUSIVE | Después de impl. |
| **generate-tests** | `e2e-tests-plan.md`, `design.md`, `requirements.md` | `e2e/*.spec.ts` | (lista de tests creados) | `/verify-implementation` step 3 |
| **healer** | `e2e/*.spec.ts`, `requirements.md` | `e2e-tests-report.md` | (análisis de pases/fallos) | `/verify-implementation` step 4 |

---

## Troubleshooting

### "El plan de tareas tiene gaps (no todos los RFs cubiertos)"
→ Corre `/planning-tasks` nuevamente — el workflow detectará RFs sin cubrir y propondrá nuevas tareas.

### "Tests fallan con TEST_DEFECT"
→ El problema es el test, no el código. Healer propone cambios en la evaluación.

### "Tests fallan con CODE_DEFECT"
→ El código no cumple el spec. Arregla la implementación y reintenta `/verify-implementation`.

### "Quiero cambiar el spec después de implementar"
→ Actualiza `requirements.md` y/o `design.md`, luego corre `/planning-tasks` para que replantee `tasks.md`.

---

## Ejemplos

### Ejemplo 1: Agregar módulo de reportes

```bash
# 1. Aclarar idea
/brainstorming

# 2. Formalizar
/specify
# → Genera: docs/specs/reportes_mensuales/{requirements.md, design.md, tasks.md}

# 3. Validar tareas
/planning-tasks
# → Itera tasks.md hasta 100% cobertura

# 4. Implementar (tu código)
# → Escribe módulo de reportes, tests unitarios

# 5. Verificar e2e
/verify-implementation
# → Genera tests, ejecuta, reporta resultados

# 6. Commit (si todo pasa)
git add .
git commit -m "feat: agregar reportes mensuales"
```

---

## Preguntas frecuentes

**P: ¿Necesito brainstorming para cambios pequeños?**
R: Sí, siempre. Incluso cambios pequeños pueden tener trade-offs no obvios.

**P: ¿Cuántas rondas toma `/planning-tasks`?**
R: Máximo 2 rondas (configurable en `converge-tasks.js`). Usualmente 1.

**P: ¿Puedo saltarme la verificación e2e?**
R: No recomendado. Es cuando descubrimos que el spec y la impl. divergen.

**P: ¿Qué pasa si un test e2e es flaky?**
R: Healer lo reporta como FLAKY. Necesitas investigar la causa (race condition, etc.).

---

*Creado para mantener el proyecto bien estructura do, documentado y verificable. 🚀*
