import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register, RenderNode } from 'claude-code'

import type { CrabAgent, CrabRun, CrabStatus, CrabTick } from '../types'
import { MAIN_COLOR, PALETTE, clip, progressSvg, treeSvg } from './svg'
import type { CrabState, Segment, TreeNode } from './svg'

const PANE = 'crab-agents'
const PANE_TITLE = '🦀 Agentes'

// Change a shape tag when that value's fields change: it declines what an
// earlier version stored, which outlives a reload.
const agentsA = atom({ plugin: 'crab-agents', key: 'agents' } as const, [], { shape: 'agents-1' })
const runA = atom({ plugin: 'crab-agents', key: 'run' } as const, null, { shape: 'run-1' })
const tickA = atom(
  { plugin: 'crab-agents', key: 'tick' } as const,
  { now: 0, costUsd: null, factor: 1 },
  { shape: 'tick-1' },
)
const hiddenA = atom({ plugin: 'crab-agents', key: 'hiddenRun' } as const, null)

type $T = EngineInterface

/** This load's own bookkeeping; a reload starts it over. */
const S = {
  rawSinceLoad: 0,
  costAtLoad: null as number | null,
  mainBusy: false,
  timer: null as { cancel: () => void } | null,
  colorIdx: 0,
  openedFor: null as string | null,
}

// ---------- formatting ----------

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function fmtUsd(usd: number | null): string {
  if (usd === null || !Number.isFinite(usd)) return '—'
  if (usd < 0.01) return `$${usd.toFixed(3)}`
  if (usd < 10) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(1)}`
}

function fmtTok(n: number): string {
  return n < 1000 ? `${n}` : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k` : `${(n / 1_000_000).toFixed(2)}M`
}

const STATUS_WORD: Record<CrabStatus, string> = {
  running: 'trabajando',
  waiting: 'esperando',
  done: 'terminado',
  failed: 'falló',
}

function isActive(a: CrabAgent): boolean {
  return a.status === 'running' || a.status === 'waiting'
}

// ---------- cost estimate ----------

/** USD per million input tokens at reference prices, by model family. */
function inputPrice(model: string): number {
  return /haiku/i.test(model) ? 1 : /sonnet/i.test(model) ? 3 : 5
}

/** Reference-price estimate of one response; calibrated against /cost. */
function estimateUsd(u: ModelUsage, model: string): number {
  return (
    ((u.input_tokens +
      5 * u.output_tokens +
      0.1 * u.cache_read_input_tokens +
      1.25 * u.cache_creation_input_tokens) *
      inputPrice(model)) /
    1_000_000
  )
}

function tokenCount(u: ModelUsage): number {
  return u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
}

// ---------- what a tool call is doing ----------

function toolLabel(e: { tool: string }): string {
  const a = e as unknown as Record<string, unknown>
  const name = e.tool.startsWith('mcp__') ? e.tool.split('__').slice(-1)[0] : e.tool
  const raw = a.description ?? a.file_path ?? a.path ?? a.pattern ?? a.command ?? a.url ?? a.query ?? a.prompt
  if (typeof raw !== 'string' || raw.length === 0) return name
  const detail = raw === a.file_path || raw === a.path ? (raw.split(/[\\/]/).pop() ?? raw) : raw
  return `${name}: ${clip(detail, 48)}`
}

function mapStatus(s: string | undefined): CrabStatus | undefined {
  if (s === 'completed') return 'done'
  if (s === 'failed' || s === 'killed') return 'failed'
  if (s === 'waiting' || s === 'idle') return 'waiting'
  if (s === 'running' || s === 'pending') return 'running'
  return undefined
}

// ---------- engine-facing helpers (top level, so `$` may be passed) ----------

async function sessionCost($: $T): Promise<number | null> {
  try {
    return (await $.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

async function tick($: $T): Promise<void> {
  const now = await $.clock.now()
  const costUsd = await sessionCost($)
  let factor = 1
  if (costUsd !== null && S.costAtLoad !== null && S.rawSinceLoad > 0.005) {
    const f = (costUsd - S.costAtLoad) / S.rawSinceLoad
    if (f > 0.2 && f < 5) factor = f
  }
  await update($, tickA, (): CrabTick => ({ now, costUsd, factor }))

  // Reconcile with the engine's own view of each agent.
  const agents = await read($, agentsA)
  if (agents.some(isActive)) {
    const byId = new Map<string, string>()
    try {
      for (const info of await $.agent.list()) byId.set(info.id, info.status)
    } catch {
      // keep what the events said
    }
    await update($, agentsA, current => {
      let changed = false
      const next = current.map(a => {
        if (!isActive(a)) return a
        const mapped = mapStatus(byId.get(a.id))
        if (mapped === undefined || mapped === a.status) return a
        changed = true
        return { ...a, status: mapped, endedAt: mapped === 'done' || mapped === 'failed' ? now : null }
      })
      return changed ? next : current
    })
  }

  const still = (await read($, agentsA)).some(isActive)
  if (!S.mainBusy && !still && S.timer) {
    S.timer.cancel()
    S.timer = null
  }
}

function ensureTimer($: $T): void {
  if (S.timer) return
  S.timer = $.clock.every(1000, () => {
    void tick($)
  })
}

async function newRun($: $T): Promise<CrabRun> {
  const now = await $.clock.now()
  const run: CrabRun = {
    id: `r${now}`,
    startedAt: now,
    mainEndedAt: null,
    costStart: await sessionCost($),
    mainTool: '',
    mainTools: 0,
    mainRawUsd: 0,
  }
  await update($, runA, () => run)
  // Keep agents still at work from an earlier run; drop the finished ones.
  await update($, agentsA, list => list.filter(isActive))
  return run
}

async function ensureRun($: $T): Promise<CrabRun> {
  return (await read($, runA)) ?? (await newRun($))
}

async function openPane($: $T): Promise<void> {
  await $.ui.open({ id: PANE, title: PANE_TITLE })
}

async function hideBand($: $T, runId: string | null): Promise<void> {
  await update($, hiddenA, () => runId)
}

async function view($: $T) {
  const run = await read($, runA)
  const agents = await read($, agentsA)
  const t = await read($, tickA)
  const shown = run ? agents.filter(a => a.runId === run.id || isActive(a)) : agents.filter(isActive)
  const anyActive = shown.some(isActive)
  const working = S.mainBusy || anyActive
  const now = Math.max(t.now, run?.startedAt ?? 0)
  const lastEnd = Math.max(run?.mainEndedAt ?? 0, ...shown.map(a => a.endedAt ?? 0))
  const elapsed = run ? (working ? now : Math.max(lastEnd, run.startedAt)) - run.startedAt : 0
  const runCost =
    run && run.costStart !== null && t.costUsd !== null ? Math.max(0, t.costUsd - run.costStart) : null
  return { run, shown, working, anyActive, elapsed, runCost, t, now }
}

export const register: Register = on => {
  // ---------- lifecycle ----------

  on('session.start', async ($, e, next) => {
    S.costAtLoad = await sessionCost($)
    await $.command.register({
      name: 'cangrejos',
      description: 'Abre el árbol de agentes cangrejo (tareas, tiempo y costo)',
    })
    return next(e)
  })

  on('command.run', { command: 'cangrejos' }, async $ => {
    await openPane($)
    return { text: '🦀 Árbol de agentes abierto.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!S.mainBusy) await newRun($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      S.mainBusy = true
      await ensureRun($)
      await update($, runA, run => (run ? { ...run, mainEndedAt: null } : run))
    } else {
      const id = e.agentId
      await update($, agentsA, list =>
        list.map(a => (a.id === id && a.status !== 'running' ? { ...a, status: 'running', endedAt: null } : a)),
      )
    }
    ensureTimer($)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const res = await next(e)
    if (!('agentId' in res) || !res.agentId) return res
    const run = await ensureRun($)
    const now = await $.clock.now()
    const agent: CrabAgent = {
      id: res.agentId,
      parentId: e.parentAgentId ?? null,
      runId: run.id,
      type: e.subagentType,
      description: e.description || clip(e.prompt, 40),
      model: res.model,
      status: 'running',
      startedAt: now,
      endedAt: null,
      tools: 0,
      lastTool: 'arrancando…',
      rawUsd: 0,
      tokens: 0,
      color: PALETTE[S.colorIdx++ % PALETTE.length],
    }
    await update($, agentsA, list => [...list.filter(a => a.id !== agent.id), agent].slice(-60))
    ensureTimer($)
    if (S.openedFor !== run.id) {
      S.openedFor = run.id
      void openPane($)
    }
    return res
  })

  on('tool.call', async ($, e, next) => {
    const label = toolLabel(e)
    if (e.agentId !== undefined) {
      const id = e.agentId
      await update($, agentsA, list =>
        list.map(a => (a.id === id ? { ...a, tools: a.tools + 1, lastTool: label } : a)),
      )
    } else {
      await update($, runA, run => (run ? { ...run, mainTool: label, mainTools: run.mainTools + 1 } : run))
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const raw = estimateUsd(u, u.model || e.model)
      const tok = tokenCount(u)
      S.rawSinceLoad += raw
      if (e.agentId !== undefined) {
        const id = e.agentId
        void update($, agentsA, list =>
          list.map(a => (a.id === id ? { ...a, rawUsd: a.rawUsd + raw, tokens: a.tokens + tok } : a)),
        )
      } else {
        void update($, runA, run => (run ? { ...run, mainRawUsd: run.mainRawUsd + raw } : run))
      }
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    if (e.agentId !== undefined) {
      const id = e.agentId
      const status: CrabStatus = e.reason === 'answer' ? 'done' : 'failed'
      const last = status === 'done' ? 'listo ✓' : `terminó: ${e.reason}`
      await update($, agentsA, list =>
        list.map(a => (a.id === id ? { ...a, status, endedAt: now, lastTool: last } : a)),
      )
    } else {
      S.mainBusy = false
      await update($, runA, run => (run ? { ...run, mainEndedAt: now } : run))
    }
    await tick($)
    return next(e)
  })

  // ---------- band above the prompt ----------

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const v = await view($)
    if (e.props.hasSurvey || !v.run) return next(e)
    if ((await read($, hiddenA)) === v.run.id) return next(e)
    const working = v.working || e.props.isWorking
    if (!working && v.shown.length === 0) return next(e)

    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const done = v.shown.filter(a => !isActive(a)).length
    const total = v.shown.length
    const running = v.shown.filter(isActive)
    const focus = running[running.length - 1]
    const activity = focus
      ? `${focus.type}: ${focus.lastTool}`
      : working
        ? v.run.mainTool
          ? `Claude: ${v.run.mainTool}`
          : 'Claude pensando…'
        : '✓ trabajo terminado'
    const summary =
      (total > 0 ? `${done}/${total} agentes · ` : '') + `⏱ ${fmtTime(v.elapsed)} · ~${fmtUsd(v.runCost)}`
    const runId = v.run.id

    const segments: Segment[] = v.shown.map(a => ({ color: a.color, state: a.status as CrabState }))
    let bar: RenderNode
    if ('Svg' in table) {
      const Svg = table.Svg
      bar = (
        <Svg
          source={progressSvg(segments, working)}
          alt={`Progreso: ${total > 0 ? `${done} de ${total} agentes` : working ? 'trabajando' : 'listo'}`}
          width={244}
          height={24}
          isInteractive
        />
      )
    } else {
      const width = Math.max(40, (e.viewport?.columns ?? 100) - 4)
      const cells = Math.min(30, Math.max(10, Math.floor(width / 4)))
      const frac = total > 0 ? done / total : working ? 0 : 1
      const fill = Math.round(frac * cells)
      bar = (
        <Text>
          🦀 <Text color={MAIN_COLOR}>{'█'.repeat(fill)}</Text>
          <Text dimColor>{'░'.repeat(cells - fill)}</Text>
        </Text>
      )
    }

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {bar}
        <Text bold tabular>
          {summary}
        </Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor wrap="truncate-end">
            {activity}
          </Text>
        </Box>
        <Button key="tree" label="🦀 Árbol" onPress={() => openPane($)} />
        <Button key="hide" label="✕" onPress={() => hideBand($, runId)} />
      </Box>
    )
  })

  // ---------- the tree pane ----------

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const v = await view($)
    const table = $.ui.resolve(e)
    const { Box, Text } = table
    const factor = v.t.factor

    const mainState: CrabState = S.mainBusy ? 'running' : v.anyActive ? 'waiting' : 'done'
    const root: TreeNode = {
      id: '__main__',
      parentId: null,
      title: 'Claude',
      subtitle: S.mainBusy ? 'principal · trabajando' : v.anyActive ? 'principal · esperando' : 'principal',
      color: MAIN_COLOR,
      state: v.run ? mainState : 'idle',
    }
    const nodes: TreeNode[] = v.shown.map(a => ({
      id: a.id,
      parentId: a.parentId,
      title: a.type,
      subtitle: a.description,
      color: a.color,
      state: a.status as CrabState,
    }))

    const ids = new Set(v.shown.map(a => a.id))
    const depthOf = (a: CrabAgent): number => {
      let d = 1
      let p = a.parentId
      const seen = new Set<string>()
      while (p && ids.has(p) && !seen.has(p)) {
        seen.add(p)
        d += 1
        p = v.shown.find(x => x.id === p)?.parentId ?? null
      }
      return d
    }
    // Rows in tree order: each agent right under its parent.
    const ordered: CrabAgent[] = []
    const walk = (parent: string | null) => {
      for (const a of v.shown) {
        const effective = a.parentId && ids.has(a.parentId) ? a.parentId : null
        if (effective === parent && !ordered.includes(a)) {
          ordered.push(a)
          walk(a.id)
        }
      }
    }
    walk(null)

    let picture: RenderNode | null = null
    if ('Svg' in table) {
      const Svg = table.Svg
      const tree = treeSvg(root, nodes)
      const room = Math.max(240, ((e.viewport?.columns ?? 80) - 2) * 8)
      picture = (
        <Svg
          source={tree.source}
          alt={`Árbol de agentes: Claude y ${nodes.length} subagentes`}
          width={Math.min(tree.width, room)}
          isInteractive
        />
      )
    }

    const done = v.shown.filter(a => !isActive(a)).length
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>
            {v.working ? '🦀 Trabajando' : v.run ? '🦀 Listo' : '🦀 Sin actividad todavía'}
            {v.shown.length > 0 ? ` · ${done}/${v.shown.length} agentes` : ''}
          </Text>
          <Text dimColor tabular>
            ⏱ {fmtTime(v.elapsed)} · ~{fmtUsd(v.runCost)} este trabajo · {fmtUsd(v.t.costUsd)} sesión
          </Text>
        </Box>

        {picture}

        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={MAIN_COLOR}>●</Text>
            <Text bold>Claude</Text>
            <Text dimColor>principal</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'   '}
            {S.mainBusy ? 'trabajando' : v.anyActive ? 'esperando a sus agentes' : 'en reposo'}
            {v.run ? ` · ${v.run.mainTools} herramientas · ~${fmtUsd(v.run.mainRawUsd * factor)}` : ''}
          </Text>
          {S.mainBusy && v.run?.mainTool ? (
            <Text dimColor wrap="truncate-end">
              {'   ↳ '}
              {v.run.mainTool}
            </Text>
          ) : null}
        </Box>

        {ordered.length === 0 ? (
          <Text dimColor>Sin subagentes todavía. Cuando Claude lance agentes, sus cangrejos aparecerán aquí.</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {ordered.map(a => {
              const pad = '  '.repeat(depthOf(a) - 1)
              const mark = a.status === 'done' ? '✓' : a.status === 'failed' ? '✗' : '●'
              const usd = a.rawUsd * factor
              const ms = (a.endedAt ?? v.now) - a.startedAt
              return (
                <Box key={a.id} flexDirection="column">
                  <Box flexDirection="row" gap={1}>
                    <Text>{pad}</Text>
                    <Text color={a.status === 'failed' ? '#d0473f' : a.color}>{mark}</Text>
                    <Text bold color={a.color}>
                      {a.type}
                    </Text>
                    <Box flexShrink={1}>
                      <Text wrap="truncate-end">{a.description}</Text>
                    </Box>
                  </Box>
                  <Text dimColor tabular wrap="truncate-end">
                    {pad}
                    {'   '}
                    {STATUS_WORD[a.status]} · ⏱ {fmtTime(ms)} · ~{fmtUsd(usd)} · {a.tools} herr. · {fmtTok(a.tokens)} tok
                  </Text>
                  {isActive(a) ? (
                    <Text dimColor wrap="truncate-end">
                      {pad}
                      {'   ↳ '}
                      {a.lastTool}
                    </Text>
                  ) : null}
                </Box>
              )
            })}
          </Box>
        )}
        <Text dimColor>Costos por agente: estimación calibrada con el total de /cost.</Text>
      </Box>
    )
  })
}
