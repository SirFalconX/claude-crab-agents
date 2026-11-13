export type CrabStatus = 'running' | 'waiting' | 'done' | 'failed'

export type CrabAgent = {
  id: string
  parentId: string | null
  runId: string
  type: string
  description: string
  model: string
  status: CrabStatus
  startedAt: number
  endedAt: number | null
  tools: number
  lastTool: string
  /** Estimated USD at reference prices (before calibration). */
  rawUsd: number
  tokens: number
  color: string
}

export type CrabRun = {
  id: string
  startedAt: number
  /** When the main loop's turn ended; null while it works. */
  mainEndedAt: number | null
  costStart: number | null
  mainTool: string
  mainTools: number
  mainRawUsd: number
  mainTokens: number
  /** The main loop's task list (update_plan / TodoWrite), when it keeps one. */
  planTotal: number
  planDone: number
  /** When the current step began. */
  stepStartedAt: number
  /** Average length of finished steps, ms; 0 until one finishes. */
  avgStepMs: number
}

export type CrabLimit = {
  kind: string
  percentUsed: number
  resetsAt: string | null
}

export type CrabTick = {
  now: number
  costUsd: number | null
  /** Session cost / raw estimate, to calibrate per-agent figures. */
  factor: number
  limits: CrabLimit[]
}

declare module 'claude-code' {
  interface PluginState {
    'crab-agents': {
      agents: Shaped<CrabAgent[]>
      run: Shaped<CrabRun | null>
      tick: Shaped<CrabTick>
      hiddenRun: string | null
    }
  }
}
