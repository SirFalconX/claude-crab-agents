import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register, RenderNode } from 'claude-code'

import type { CrabAgent, CrabLimit, CrabRun, CrabStatus, CrabTick } from '../types'
import { LIMIT_BLOCKS, MAIN_COLOR, PALETTE, clip, fillSvg, limitsSvg, treeSvg } from './svg'
import type { CrabProp, CrabState, LimitRow, TreeNode } from './svg'

const PANE = 'crab-agents'
const PANE_TITLE = '🦀 Agentes'

// Change a shape tag when that value's fields change: it declines what an
// earlier version stored, which outlives a reload.
const agentsA = atom({ plugin: 'crab-agents', key: 'agents' } as const, [], { shape: 'agents-1' })
const runA = atom({ plugin: 'crab-agents', key: 'run' } as const, null, { shape: 'run-3' })
const tickA = atom(
  { plugin: 'crab-agents', key: 'tick' } as const,
  { now: 0, costUsd: null, factor: 1, limits: [] },
  { shape: 'tick-2' },
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
  /** Agent tool calls made inside a subagent: tool_use_id → that subagent's id. */
  spawnParent: new Map<string, string>(),
  /** The bar never moves back within a run. */
  shownFrac: { runId: '', frac: 0 },
  /** Blocks each limit's bar held last time, and when it last lost some. */
  lastBlocks: new Map<string, number>(),
  drops: new Map<string, { at: number; from: number; to: number }>(),
}

// ---------- formatting ----------

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
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
  let costUsd: number | null = null
  let limits: CrabLimit[] = []
  try {
    const usage = await $.session.usage()
    costUsd = usage.cost?.usd ?? null
    limits = usage.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt ?? null }))
  } catch {
    // keep the figures empty
  }
  let factor = 1
  if (costUsd !== null && S.costAtLoad !== null && S.rawSinceLoad > 0.005) {
    const f = (costUsd - S.costAtLoad) / S.rawSinceLoad
    if (f > 0.2 && f < 5) factor = f
  }
  await update($, tickA, (prev): CrabTick => ({ now, costUsd, factor, limits: limits.length > 0 ? limits : prev.limits }))

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
    mainTokens: 0,
    planTotal: 0,
    planDone: 0,
    stepStartedAt: now,
    avgStepMs: 0,
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

// ---------- progress estimate ----------

type PlanChange = { total?: number; done?: number; advance?: number }

/** What a task-list tool call says about the main loop's plan. */
function planChange(e: { tool: string }): PlanChange | null {
  const a = e as unknown as Record<string, unknown>
  const list = (a.items ?? a.todos) as unknown
  if (e.tool === 'TodoWrite' || /update_plan$/.test(e.tool)) {
    if (Array.isArray(list)) {
      const items = list as { status?: string }[]
      return { total: items.length, done: items.filter(i => i.status === 'completed').length }
    }
    if (a.advance === true) return { advance: 1 }
    if (Array.isArray(a.done)) return { advance: (a.done as unknown[]).length }
  }
  return null
}

async function trackPlan($: $T, change: PlanChange): Promise<void> {
  const now = await $.clock.now()
  await update($, runA, run => {
    if (!run) return run
    const total = change.total ?? run.planTotal
    const done = Math.min(total, change.done ?? run.planDone + (change.advance ?? 0))
    if (done === run.planDone && total === run.planTotal) return run
    const finished = Math.max(0, done - run.planDone)
    let avg = run.avgStepMs
    if (finished > 0) {
      const each = (now - run.stepStartedAt) / finished
      const count = Math.max(1, run.planDone)
      avg = avg === 0 ? each : (avg * count + each * finished) / (count + finished)
    }
    return { ...run, planTotal: total, planDone: done, avgStepMs: avg, stepStartedAt: finished > 0 ? now : run.stepStartedAt }
  })
}

/** 0..1 how far the work is, or null when nothing says. */
function estimateFrac(run: CrabRun, shown: CrabAgent[], now: number, working: boolean): number | null {
  if (!working) return 1
  const elapsed = Math.max(1, now - run.startedAt)
  if (run.planTotal > 0) {
    const avg = run.avgStepMs > 0 ? run.avgStepMs : run.planDone > 0 ? elapsed / run.planDone : 60_000
    const partial = Math.min(0.9, (now - run.stepStartedAt) / avg)
    return Math.min(0.98, (run.planDone + partial) / run.planTotal)
  }
  if (shown.length > 0) {
    const finished = shown.filter(a => !isActive(a) && a.endedAt !== null)
    const avg =
      finished.length > 0
        ? finished.reduce((s, a) => s + ((a.endedAt as number) - a.startedAt), 0) / finished.length
        : 90_000
    const sum = shown.reduce((s, a) => s + (isActive(a) ? Math.min(0.9, (now - a.startedAt) / avg) : 1), 0)
    return Math.min(0.98, sum / shown.length)
  }
  return null
}

function limitLabel(kind: string): string {
  const k = kind.toLowerCase()
  const model = /fable/.test(k) ? 'Fable' : /opus/.test(k) ? 'Opus' : /sonnet/.test(k) ? 'Sonnet' : /haiku/.test(k) ? 'Haiku' : ''
  if (model) return `${model} (semana)`
  if (/five_hour|5h|session/.test(k)) return 'Sesión (5 h)'
  if (/seven_day|week/.test(k)) return 'Semana'
  if (/spend/.test(k)) return 'Gasto'
  return kind
}

const BURST_MS = 2500

function limitRows(limits: CrabLimit[], now: number): LimitRow[] {
  const rows: LimitRow[] = limits.map(l => {
    const left = Math.max(0, Math.min(100, 100 - l.percentUsed))
    const resets = l.resetsAt ? Date.parse(l.resetsAt) : NaN
    const when = Number.isFinite(resets) && resets > now ? `reinicia en ${fmtTime(resets - now)}` : ''
    // Blocks that just went out burst into pixels for a moment.
    const blocks = Math.round((left / 100) * LIMIT_BLOCKS)
    const before = S.lastBlocks.get(l.kind)
    if (before !== undefined && blocks < before) S.drops.set(l.kind, { at: now, from: before, to: blocks })
    S.lastBlocks.set(l.kind, blocks)
    const drop = S.drops.get(l.kind)
    const lost: number[] = []
    if (drop && now - drop.at < BURST_MS) for (let b = drop.to; b < drop.from; b++) lost.push(b)
    return { label: limitLabel(l.kind), left, note: `${Math.round(left)}% restante${when ? ' · ' + when : ''}`, lost }
  })
  const order = (r: LimitRow) => (r.label.startsWith('Sesión') ? 0 : r.label === 'Semana' ? 1 : r.label.startsWith('Fable') ? 2 : 3)
  rows.sort((a, b) => order(a) - order(b))
  if (!rows.some(r => r.label.startsWith('Fable'))) rows.push({ label: 'Fable (semana)', left: null, note: 'sin datos de este límite' })
  return rows
}

/** How tired main Claude looks, from what is left of the weekly limit. */
function tiredness(limits: CrabLimit[]): number {
  const week = limits.find(l => l.kind === 'seven_day') ?? limits.find(l => /seven_day|week/i.test(l.kind))
  if (!week) return 0
  const left = 100 - week.percentUsed
  return left >= 60 ? 0 : left >= 30 ? 1 : left >= 10 ? 2 : 3
}

function propFor(type: string): CrabProp {
  return /explore|search|research/i.test(type) ? 'magnifier' : 'laptop'
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
  let frac = run ? estimateFrac(run, shown, now, working) : null
  if (run && frac !== null) {
    if (S.shownFrac.runId !== run.id) S.shownFrac = { runId: run.id, frac: 0 }
    frac = working ? Math.max(S.shownFrac.frac, frac) : 1
    S.shownFrac.frac = frac
  }
  const remaining = working && frac !== null && frac > 0.03 ? (elapsed * (1 - frac)) / frac : null
  return { run, shown, working, anyActive, elapsed, runCost, t, now, frac, remaining }
}

export const register: Register = on => {
  // ---------- lifecycle ----------

  on('session.start', async ($, e, next) => {
    S.costAtLoad = await sessionCost($)
    await tick($)
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
      parentId: e.parentAgentId ?? S.spawnParent.get(e.tool_use_id) ?? null,
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
    if (e.agentId !== undefined && (e.tool === 'Agent' || e.tool === 'Task') && e.tool_use_id) {
      S.spawnParent.set(e.tool_use_id, e.agentId)
    }
    if (e.agentId !== undefined) {
      const id = e.agentId
      await update($, agentsA, list =>
        list.map(a => (a.id === id ? { ...a, tools: a.tools + 1, lastTool: label } : a)),
      )
    } else {
      await update($, runA, run => (run ? { ...run, mainTool: label, mainTools: run.mainTools + 1 } : run))
      const change = planChange(e)
      if (change) await trackPlan($, change)
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
        void update($, runA, run =>
          run ? { ...run, mainRawUsd: run.mainRawUsd + raw, mainTokens: run.mainTokens + tok } : run,
        )
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
    const pct = v.frac === null ? null : Math.round(v.frac * 100)
    const eta = !working
      ? '✓ listo'
      : v.remaining === null
        ? '⏳ calculando…'
        : `⏳ ~${fmtTime(v.remaining)} restante`
    const summary =
      `${eta}${pct !== null && working ? ` · ${pct}%` : ''} · ⏱ ${fmtTime(v.elapsed)} · ~${fmtUsd(v.runCost)}` +
      (total > 0 ? ` · ${done}/${total} agentes` : '')
    const runId = v.run.id

    let bar: RenderNode
    if ('Svg' in table) {
      const Svg = table.Svg
      bar = (
        <Svg
          source={fillSvg(v.frac, working, 300, tiredness(v.t.limits))}
          alt={`Progreso: ${pct === null ? 'calculando' : `${pct}%`}`}
          width={300}
          height={30}
          isInteractive
        />
      )
    } else {
      const width = Math.max(40, (e.viewport?.columns ?? 100) - 4)
      const cells = Math.min(30, Math.max(10, Math.floor(width / 4)))
      const frac = v.frac ?? 0
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
    // Each bar is that crab's share of this work's cost.
    const totalRaw = (v.run?.mainRawUsd ?? 0) + v.shown.reduce((sum, a) => sum + a.rawUsd, 0)
    const share = (raw: number) => (totalRaw > 0 ? raw / totalRaw : 0)
    const usageText = (tok: number, raw: number, tools: number) =>
      `${fmtTok(tok)} tok · ~${fmtUsd(raw * factor)} · ${tools} herr`
    const root: TreeNode = {
      usage: v.run
        ? { text: usageText(v.run.mainTokens, v.run.mainRawUsd, v.run.mainTools), frac: share(v.run.mainRawUsd) }
        : undefined,
      id: '__main__',
      parentId: null,
      title: 'Claude',
      subtitle: S.mainBusy ? 'principal · trabajando' : v.anyActive ? 'principal · esperando' : 'principal',
      color: MAIN_COLOR,
      state: v.run ? mainState : 'idle',
      opts: { tired: tiredness(v.t.limits) },
    }
    const nodes: TreeNode[] = v.shown.map(a => ({
      id: a.id,
      parentId: a.parentId,
      title: a.type,
      subtitle: a.description,
      color: a.color,
      state: a.status as CrabState,
      usage: { text: usageText(a.tokens, a.rawUsd, a.tools), frac: share(a.rawUsd) },
      opts: { prop: propFor(a.type) },
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

    const limits = limitRows(v.t.limits, v.now || Date.now())
    let limitsPic: RenderNode | null = null
    if ('Svg' in table) {
      const Svg = table.Svg
      limitsPic = (
        <Box alignSelf="flex-start">
          <Svg
            source={limitsSvg(limits)}
            alt={limits.map(l => `${l.label}: ${l.note}`).join('; ')}
            width={460}
            height={limits.length * 44}
            isInteractive
          />
        </Box>
      )
    } else {
      limitsPic = (
        <Box flexDirection="column">
          {limits.map(l => (
            <Text key={l.label} dimColor>
              {l.label}: {l.note}
            </Text>
          ))}
        </Box>
      )
    }

    let picture: RenderNode | null = null
    if ('Svg' in table) {
      const Svg = table.Svg
      const tree = treeSvg(root, nodes)
      // Drawn larger than its own units, at a fixed size: the box grows
      // downward with each agent instead of shrinking the crabs to fit.
      const zoom = 1.5
      picture = (
        <Box alignSelf="flex-start">
          <Svg
            source={tree.source}
            alt={`Árbol de agentes: Claude y ${nodes.length} subagentes`}
            width={Math.round(tree.width * zoom)}
            height={Math.round(tree.height * zoom)}
            isInteractive
          />
        </Box>
      )
    }

    const done = v.shown.filter(a => !isActive(a)).length
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>🕹 Uso restante</Text>
          {limitsPic}
        </Box>
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
