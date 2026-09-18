export const meta = {
  name: 'converge-tasks',
  description: 'Fan-out planner agents to iterate tasks.md against a feature spec (requirements + design)',
  whenToUse: 'Use when you want to evaluate and refine implementation tasks against a spec. Pass the spec folder path as args (string), or {specPath, maxRounds} (object). Omit to auto-discover under docs/specs/.',
  phases: [
    { title: 'Scout', detail: 'Read spec, extract RFs and tasks, determine mode' },
    { title: 'Plan', detail: 'Fan-out planner agents — bootstrap if empty, one per task otherwise' },
    { title: 'Reduce', detail: 'Collect verdicts, check RF coverage, detect conflicts' },
    { title: 'Write', detail: 'Consolidate all changes into final tasks.md' },
  ],
}

// ============================================================
// CONFIG — edit this value to control how many rounds run (1-4)
// Also overridable via args: { specPath: "...", maxRounds: 3 }
// ============================================================
const MAX_ROUNDS = 2

// ============================================================
// Schemas
// ============================================================

const SCOUT_SCHEMA = {
  type: 'object',
  required: ['specPath', 'mode', 'rfs', 'tasks'],
  properties: {
    specPath: { type: 'string' },
    mode: { type: 'string', enum: ['from_scratch', 'iterative'] },
    rfs: {
      type: 'array',
      items: { type: 'string' },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'status', 'covers'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string' },
          covers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const BOOTSTRAP_SCHEMA = {
  type: 'object',
  required: ['tasksCreated'],
  properties: {
    tasksCreated: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'covers'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          covers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['taskId', 'taskName', 'verdict', 'justification', 'suggestedChanges'],
  properties: {
    taskId: { type: 'string' },
    taskName: { type: 'string' },
    verdict: {
      type: 'string',
      enum: ['APROBADA', 'MODIFICAR', 'DIVIDIR', 'FUSIONAR', 'DESCARTAR', 'NUEVA'],
    },
    justification: { type: 'string' },
    suggestedChanges: { type: 'string' },
    mergeWith: { type: 'string' },
    uncoveredRfs: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

const WRITER_SCHEMA = {
  type: 'object',
  required: ['tasksWritten', 'rfsCovered', 'totalRfs', 'allCovered', 'summary'],
  properties: {
    tasksWritten: { type: 'integer' },
    rfsCovered: { type: 'integer' },
    totalRfs: { type: 'integer' },
    allCovered: { type: 'boolean' },
    summary: { type: 'string' },
  },
}

// ============================================================
// Parse args
// ============================================================

let specHint = ''
let maxRounds = MAX_ROUNDS

if (args && typeof args === 'object' && args.specPath) {
  specHint = String(args.specPath)
  if (args.maxRounds) maxRounds = Math.min(Math.max(Number(args.maxRounds), 1), 4)
} else if (args) {
  specHint = String(args)
}

log(`Config: maxRounds = ${maxRounds}`)

// ============================================================
// Phase 1: Scout — read spec, determine mode
// ============================================================
phase('Scout')

const scout = await agent(
  `You are a spec analyzer. Read a feature spec and report its structure.

${specHint
    ? `The spec is at: ${specHint}`
    : 'Find the spec folder under docs/specs/. Look for folders containing both requirements.md and design.md. If multiple exist, pick the most recently modified one.'}

Steps:
1. Read requirements.md — extract every RF identifier (RF-1, RF-2, etc.)
2. Read tasks.md — extract every TASK entry (TASK-1, TASK-2, etc.) with its name, status, and which RFs it covers
3. Determine mode:
   - "from_scratch" if tasks.md does not exist, is empty, or contains no TASK-N entries
   - "iterative" if tasks.md has one or more TASK-N entries

Return the absolute path to the spec folder, all RF identifiers, all tasks, and the mode.`,
  { label: 'scout', schema: SCOUT_SCHEMA }
)

if (!scout) {
  log('ERROR: Scout agent failed. Cannot proceed.')
  return { error: 'Scout agent failed' }
}

log(`Spec: ${scout.specPath}`)
log(`Mode: ${scout.mode} | RFs: ${scout.rfs.length} | Tasks: ${scout.tasks.length}`)

const specPath = scout.specPath
const totalRfCount = scout.rfs.length

// ============================================================
// Bootstrap if from_scratch (only on first pass)
// ============================================================

let currentTasks = scout.tasks

if (scout.mode === 'from_scratch') {
  phase('Plan')
  log('No tasks found — bootstrapping initial estimation...')

  const bootstrap = await agent(
    `You are an expert implementation planner. The spec at "${specPath}" has requirements.md and design.md but NO tasks defined yet.

Read both files completely. Generate an initial set of implementation tasks and WRITE them to tasks.md at "${specPath}/tasks.md".

Follow this structure for each task:
### TASK-N: descriptive name in imperative
- **Cubre:** RF-N, RF-M
- **Componente:** component from design.md
- **Tipo:** setup | feature | refactor | test
- **Estado:** pendiente

**Descripcion:**
1-3 sentences describing the work.

**Criterio de done:**
- [ ] verifiable condition

**Log de decisiones:**
| Fecha | Decision | Contexto |
|---|---|---|
| | | |

Rules:
- Each task covers 1-3 RFs max
- Order by dependency (foundations first)
- 100% of RFs must be covered by at least one task
- Done criteria must be verifiable
- Do NOT generate implementation code
- Do NOT modify requirements.md or design.md`,
    { label: 'bootstrap', phase: 'Plan', schema: BOOTSTRAP_SCHEMA }
  )

  if (!bootstrap) {
    log('ERROR: Bootstrap agent failed.')
    return { error: 'Bootstrap failed' }
  }

  currentTasks = bootstrap.tasksCreated.map(t => ({
    id: t.id,
    name: t.name,
    status: 'pendiente',
    covers: t.covers,
  }))

  log(`Bootstrap: ${currentTasks.length} tasks generated`)
}

// ============================================================
// Iteration loop: Plan → Reduce → Write, up to maxRounds
// ============================================================

const allRoundResults = []
let converged = false

for (let round = 1; round <= maxRounds; round++) {
  log(`\n========== Round ${round}/${maxRounds} ==========`)

  // --- Re-scout on rounds 2+ to pick up writer's changes ---
  if (round > 1) {
    phase('Scout')
    log('Re-reading tasks.md after writer changes...')

    const rescan = await agent(
      `You are a spec analyzer. Re-read the spec at "${specPath}".

Steps:
1. Read requirements.md — extract every RF identifier (RF-1, RF-2, etc.)
2. Read tasks.md — extract every TASK entry with its name, status, and which RFs it covers
3. Mode is always "iterative" on a re-scan

Return the spec path, all RF identifiers, all tasks, and mode "iterative".`,
      { label: `rescan-r${round}`, schema: SCOUT_SCHEMA }
    )

    if (!rescan) {
      log(`ERROR: Re-scan failed on round ${round}. Stopping.`)
      break
    }

    currentTasks = rescan.tasks
    log(`Re-scan: ${currentTasks.length} tasks found`)
  }

  // --- Plan: fan-out ---
  phase('Plan')

  const tasksToEvaluate = currentTasks.filter(t =>
    t.status === 'pendiente' || t.status === 'en progreso'
  )

  if (tasksToEvaluate.length === 0) {
    log('No pending tasks to evaluate. Converged.')
    converged = true
    break
  }

  log(`Fanning out ${tasksToEvaluate.length} planner agents...`)

  const verdicts = (await parallel(
    tasksToEvaluate.map(task => () =>
      agent(
        `You are an expert implementation planner. Evaluate task ${task.id} ("${task.name}") from the spec at "${specPath}".

Read requirements.md, design.md, and tasks.md completely. Also explore the project for any existing implementation files.

Evaluate ${task.id} against these criteria:
1. SIZE — Completable in one coherent step? Covers max 2-3 RFs? Verifiable done criteria?
2. ALIGNMENT — Do the RFs it claims to cover actually match? Is the component correct per design.md?
3. COMPLETENESS — Are there RFs not covered by ANY task in tasks.md?
4. NECESSITY — Does it solve something the spec requires, or is it scope creep?
5. FEASIBILITY — Is it viable to implement now given the current project state?

Emit exactly ONE verdict:
- APROBADA: meets all criteria, no changes needed
- MODIFICAR: valid but needs adjustments (describe exactly what in suggestedChanges)
- DIVIDIR: too large — describe the sub-tasks in suggestedChanges
- FUSIONAR: too small or overlaps another task — set mergeWith to the other task ID
- DESCARTAR: unnecessary (already done, duplicate, out of scope)
- NUEVA: detected uncovered RFs — describe the needed task in suggestedChanges and list the uncovered RFs

Be conservative with DESCARTAR, aggressive with DIVIDIR.

IMPORTANT: Do NOT edit any files. Only evaluate and report via structured output. A separate writer agent will apply all changes.`,
        { label: `${task.id}-r${round}`, phase: 'Plan', schema: VERDICT_SCHEMA }
      )
    )
  )).filter(Boolean)

  const dropped = tasksToEvaluate.length - verdicts.length
  if (dropped > 0) log(`WARNING: ${dropped} planner agent(s) failed — results dropped`)

  // --- Reduce: pure JS ---
  phase('Reduce')

  const approved = verdicts.filter(v => v.verdict === 'APROBADA')
  const modified = verdicts.filter(v => v.verdict === 'MODIFICAR')
  const divided = verdicts.filter(v => v.verdict === 'DIVIDIR')
  const merged = verdicts.filter(v => v.verdict === 'FUSIONAR')
  const discarded = verdicts.filter(v => v.verdict === 'DESCARTAR')
  const nueva = verdicts.filter(v => v.verdict === 'NUEVA')

  const allUncovered = [...new Set(verdicts.flatMap(v => v.uncoveredRfs || []))]

  const mergeTargets = merged.map(v => [v.taskId, v.mergeWith || ''].sort().join('+'))
  const mergeConflicts = mergeTargets.filter((t, i, arr) => arr.indexOf(t) !== i)

  log(`Verdicts: ${approved.length} APROBADA | ${modified.length} MODIFICAR | ${divided.length} DIVIDIR | ${merged.length} FUSIONAR | ${discarded.length} DESCARTAR | ${nueva.length} NUEVA`)
  if (allUncovered.length > 0) log(`Uncovered RFs: ${allUncovered.join(', ')}`)
  if (mergeConflicts.length > 0) log(`Merge conflicts: ${mergeConflicts.join(', ')}`)

  const hasChanges = (modified.length + divided.length + merged.length + discarded.length + nueva.length + allUncovered.length) > 0

  const verdictSummary = verdicts.map(v =>
    `- ${v.taskId} (${v.taskName}): ${v.verdict}${v.suggestedChanges ? ' — ' + v.suggestedChanges : ''}${v.mergeWith ? ' [merge with ' + v.mergeWith + ']' : ''}`
  ).join('\n')

  // --- Check early convergence before writing ---
  if (!hasChanges && approved.length === tasksToEvaluate.length) {
    log(`All ${approved.length} tasks APROBADA — converged on round ${round}.`)
    converged = true

    const writerVerify = await agent(
      `You are the final consolidator for a planning workflow. The spec is at "${specPath}".

All tasks were APPROVED by the planner agents. Verify tasks.md is correct and complete — no changes expected.

## Verdicts:
${verdictSummary}

Instructions:
1. Read tasks.md and requirements.md from "${specPath}"
2. Verify 100% of RFs are covered
3. Verify dependency order is coherent
4. Do NOT make changes unless you find a real inconsistency

Rules:
- Do NOT modify requirements.md or design.md
- Do NOT generate implementation code`,
      { label: `writer-r${round}`, phase: 'Write', schema: WRITER_SCHEMA }
    )

    allRoundResults.push({
      round,
      verdicts: verdicts.map(v => ({ taskId: v.taskId, verdict: v.verdict, justification: v.justification })),
      writer: writerVerify,
      converged: true,
    })

    break
  }

  // --- Write: single agent applies changes ---
  phase('Write')

  const writer = await agent(
    `You are the final consolidator for a planning workflow. The spec is at "${specPath}".

Planner agents evaluated all tasks and proposed changes. Apply them to tasks.md in a single coherent pass.

## Verdicts from planner agents (round ${round}/${maxRounds}):
${verdictSummary}

${allUncovered.length > 0 ? '## Uncovered RFs needing new tasks: ' + allUncovered.join(', ') : ''}
${mergeConflicts.length > 0 ? '## Merge conflicts to resolve: ' + mergeConflicts.join(', ') : ''}

## Instructions:
1. Read the current tasks.md and requirements.md from "${specPath}"
2. Apply ALL changes from the verdicts:
   - APROBADA: no changes
   - MODIFICAR: edit the task section as described
   - DIVIDIR: replace the original task with the proposed sub-tasks (use TASK-Na, TASK-Nb or renumber)
   - FUSIONAR: merge the two tasks into one, combining their RF coverage
   - DESCARTAR: mark the task as "descartada" in its status
   - NUEVA: add the proposed new task at the correct dependency position
3. For any uncovered RFs, create new tasks to cover them
4. Verify that 100% of RFs from requirements.md are covered
5. Ensure dependency order is coherent (no task depends on something after it)
6. Write the final tasks.md

Rules:
- Preserve the tasks template format exactly (headers, metadata, done criteria, decision log)
- Keep stable numbering where possible
- Do NOT modify requirements.md or design.md
- Do NOT generate implementation code`,
    { label: `writer-r${round}`, schema: WRITER_SCHEMA }
  )

  if (!writer) {
    log(`ERROR: Writer agent failed on round ${round}.`)
    allRoundResults.push({ round, verdicts: verdicts.map(v => ({ taskId: v.taskId, verdict: v.verdict })), writer: null, converged: false })
    break
  }

  log(`Round ${round} done: ${writer.tasksWritten} tasks | ${writer.rfsCovered}/${writer.totalRfs} RFs`)
  log(writer.allCovered ? 'Coverage: 100%' : 'WARNING: coverage gaps remain')

  allRoundResults.push({
    round,
    verdicts: verdicts.map(v => ({ taskId: v.taskId, verdict: v.verdict, justification: v.justification })),
    writer,
    converged: false,
  })
}

// ============================================================
// Final summary
// ============================================================

const lastRound = allRoundResults[allRoundResults.length - 1]
const lastWriter = lastRound ? lastRound.writer : null

log(`\n========== FINAL ==========`)
log(`Rounds: ${allRoundResults.length}/${maxRounds} | Converged: ${converged}`)
if (lastWriter) {
  log(`Tasks: ${lastWriter.tasksWritten} | RFs: ${lastWriter.rfsCovered}/${lastWriter.totalRfs} | 100%: ${lastWriter.allCovered}`)
  log(lastWriter.summary)
}

return {
  specPath,
  mode: scout.mode,
  maxRounds,
  roundsExecuted: allRoundResults.length,
  converged,
  totalRfs: lastWriter ? lastWriter.totalRfs : totalRfCount,
  tasksWritten: lastWriter ? lastWriter.tasksWritten : 0,
  rfsCovered: lastWriter ? lastWriter.rfsCovered : 0,
  allCovered: lastWriter ? lastWriter.allCovered : false,
  rounds: allRoundResults,
  summary: lastWriter ? lastWriter.summary : 'No writer completed',
}
