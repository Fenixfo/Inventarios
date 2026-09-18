# 📦 Sistema de Inventarios

*Un proyecto estructurado siguiendo el flujo de trabajo del "Agente para Proyectos".*

---

## ✨ Flujo de Trabajo

Este proyecto sigue un flujo estructurado y automatizado para planificar, especificar, implementar y verificar features:

```
1️⃣  BRAINSTORMING
    └─ /brainstorming → Acuerdas la idea

2️⃣  ESPECIFICACIÓN
    └─ /specify → Escribes requirements + design + tasks

3️⃣  PLANIFICACIÓN DE TAREAS
    └─ /planning-tasks → Refinas las tareas

4️⃣  IMPLEMENTACIÓN
    └─ (Tu código aquí)

5️⃣  PLANIFICACIÓN DE TESTS
    └─ /plan-test-cases → Diseñas qué probar

6️⃣  GENERACIÓN DE TESTS
    └─ generate-tests → Escribe los tests automáticamente

7️⃣  VERIFICACIÓN E2E
    └─ healer → Corre tests y diagnostica

8️⃣  COMMIT
    └─ ✅ Listo!
```

---

## 🎮 Cómo empezar

### Paso 1: Tienes una idea
Corre `/brainstorming` para clarificar qué quieres construir.

### Paso 2: Idea clara
Corre `/specify` para materializar la idea en documentación estructurada:
- `requirements.md` — qué debe hacer (notación EARS)
- `design.md` — cómo se construye (arquitectura)
- `tasks.md` — qué tareas hacen falta

### Paso 3: Refina el plan
Corre `/planning-tasks` para validar que todas las tareas sean coherentes con el spec.

### Paso 4: Implementa
Escribe el código siguiendo las tareas del spec.

### Paso 5: Verifica
Corre `/plan-test-cases` → `generate-tests` → `healer` para validar que todo funciona.

### Paso 6: Commit
¡Listo! Tu feature está lista para mergear.

---

## 📁 Estructura

```
.claude/
├── settings.local.json       ⚙️ Configuración de permisos
├── agents/                   🤖 Agentes inteligentes
│   ├── planner.md           → Evalúa tareas contra el spec
│   ├── task-verifier.md     → Verifica que la impl. cumple el spec
│   ├── healer.md            → Ejecuta tests y diagnostica
│   └── generate-tests.md    → Genera tests automáticamente
├── skills/                   🛠️ Habilidades del sistema
│   ├── brainstorming/       → Para clarificar ideas
│   ├── specify/             → Para escribir especificaciones
│   ├── planning-tasks/      → Para refinar tareas
│   ├── plan-test-cases/     → Para planificar tests
│   └── verify-implementation/ → Para verificar implementación
└── workflows/               ⚡ Flujos de trabajo
    └── converge-tasks.js    → Itera tareas automáticamente

docs/specs/
├── <feature-1>/
│   ├── requirements.md       📋 Qué hace (EARS)
│   ├── design.md           🏗️ Cómo se construye
│   ├── tasks.md            ✅ Plan de trabajo
│   └── e2e-tests-plan.md   🧪 Plan de tests (generado)
└── <feature-2>/
    └── (igual estructura)
```

---

## 🎯 Componentes principales

### Skills (Habilidades)

| Skill | Propósito | Resultado |
|-------|-----------|-----------|
| **brainstorming** | Clarificar la idea | Diseño aprobado (verbal) |
| **specify** | Formalizar en documentos | `requirements.md` + `design.md` + `tasks.md` |
| **planning-tasks** | Validar y refinar tareas | `tasks.md` iterado y verificado |
| **plan-test-cases** | Diseñar tests e2e | `e2e-tests-plan.md` |
| **verify-implementation** | Orquestar verificación e2e | `e2e-tests-report.md` |

### Agentes (Inteligencia automática)

| Agente | Propósito | Entrada | Salida |
|--------|-----------|---------|--------|
| **planner** | Evalúa tareas | Una tarea de `tasks.md` | Veredicto (APROBADA/MODIFICAR/DIVIDIR/etc) |
| **task-verifier** | Verifica impl. | Una tarea + tests | PASS/FAIL/INCONCLUSIVE |
| **generate-tests** | Genera tests e2e | `e2e-tests-plan.md` | Archivos `.spec.ts` / `.spec.js` en `e2e/` |
| **healer** | Ejecuta y diagnostica | Tests en `e2e/` | `e2e-tests-report.md` |

### Workflows

| Workflow | Cuándo | Qué hace |
|----------|--------|----------|
| **converge-tasks** | Después de `/specify` | Scout → Plan (fanout) → Reduce → Write (4 fases automáticas) |

---

## 📚 Archivos importantes

### `.claude/settings.local.json`
Permisos y configuración de MCP servers (Playwright para tests e2e).

### `docs/specs/<feature>/`
Cada feature tiene su carpeta con:

- **requirements.md** — Especificación con notación EARS
  - RFs (requisitos funcionales): `WHEN X THE SYSTEM SHALL Y`
  - RNFs (requisitos no funcionales): performance, seguridad, etc.
  - Criterios de aceptación verificables

- **design.md** — Arquitectura y decisiones técnicas
  - Componentes y responsabilidades
  - Interfaces y contratos
  - Modelos de datos
  - Manejo de errores
  - Estrategia de testing

- **tasks.md** — Plan de implementación
  - Tareas ordenadas por dependencia
  - Criterios de done verificables
  - Log de decisiones (se llena durante la impl.)

- **e2e-tests-plan.md** — Plan de tests (generado)
  - 3 test cases: 1 happy path + 2 fallos

- **e2e-tests-report.md** — Reporte de verificación (generado)
  - Resultado de tests
  - Diagnostico de fallos

---

## 💡 Ejemplo: Agregar una feature

```bash
# 1. Clarificar idea
/brainstorming

# 2. Escribir spec (leerá el contexto del brainstorm)
/specify

# 3. Refinar tareas (planners evalúan en paralelo, escritor consolida)
/planning-tasks

# 4. Implementar (tu código aquí)

# 5. Validar con tests e2e (3 pasos automáticos)
/plan-test-cases
generate-tests  (subagente)
healer          (subagente)

# 6. Si todo pasa: git commit
git commit -m "feat: agregar X"
```

---

## 🔄 El ciclo automático

### converge-tasks (después de `/specify`)

Cuando llamas `/planning-tasks`, el workflow `converge-tasks` hace:

1. **Scout** — Lee el spec, extrae RFs y tareas actuales
2. **Plan** — Lanza múltiples `planner` agents en paralelo (uno por tarea)
3. **Reduce** — Analiza los veredictos, detecta conflictos, verifica cobertura
4. **Write** — Un único agente consolida todos los cambios en `tasks.md`

Esto itera hasta que todas las tareas estén APROBADAS (máx. 2 rondas).

---

## 🎓 Filosofía

✨ **Traceabilidad**: Cada tarea se mapea a RFs, cada RF a criterios de aceptación, cada criterio a tests.

✨ **Automatización**: Los agentes hacen el trabajo repetitivo (evaluar tareas, generar tests, diagnosticar fallos).

✨ **Estructura**: Specs versionados + documentación clara = menos sorpresas.

✨ **Verificación**: Tests e2e automáticos + healer = confianza en la impl.

---

## 📖 Próximos pasos

1. **Lee los skills** en `.claude/skills/` para entender cada etapa
2. **Lee los agentes** en `.claude/agents/` para ver cómo evalúan y verifican
3. **Comienza un brainstorming** cuando tengas una idea clara
4. **Sigue el workflow** hasta que todo esté verificado y listo para mergear

---

*Proyecto basado en "Agente para Proyectos" — un sistema inteligente para construir software mejor. 🚀*
