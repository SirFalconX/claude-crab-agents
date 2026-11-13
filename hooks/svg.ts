// Pixel-art crabs, the agent tree and the progress bar, as SVG strings.
// Animations are CSS keyframes inside the SVG (drawn with isInteractive so
// they run). Nothing time-dependent goes into these strings, so a redraw
// for the clock does not restart the animations.

export type CrabState = 'running' | 'waiting' | 'done' | 'failed' | 'idle'

export const MAIN_COLOR = '#D97757'
export const PALETTE = [
  '#E8845F',
  '#3FA7A0',
  '#E0A33B',
  '#8E7CC3',
  '#5B8DEF',
  '#E06C9F',
  '#6AAE5B',
  '#C9653E',
]

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )

export const clip = (s: string, n: number): string => {
  const chars = Array.from(s.replace(/\s+/g, ' ').trim())
  return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : chars.join('')
}

const shade = (hex: string, amount: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

const mixGrey = (hex: string, amount: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const g = (c[0] + c[1] + c[2]) / 3
  const out = c.map(v => Math.round(v + (g - v) * amount))
  return '#' + ((1 << 24) | (out[0] << 16) | (out[1] << 8) | out[2]).toString(16).slice(1)
}

const CSS = `
.crab .body-g{transform-box:fill-box;transform-origin:50% 100%}
.crab .fing{transform-box:fill-box}
.crab .fl{transform-origin:100% 100%}
.crab .fr{transform-origin:0% 100%}
.st-running .body-g{animation:bob .44s linear infinite;animation-delay:var(--d)}
.st-running .legA{animation:legs .44s linear infinite;animation-delay:var(--d)}
.st-running .legB{animation:legs .44s linear infinite;animation-delay:calc(var(--d) - .22s)}
.st-running .fl{animation:snapL .28s ease-in-out infinite alternate;animation-delay:var(--d)}
.st-running .fr{animation:snapR .28s ease-in-out infinite alternate;animation-delay:calc(var(--d) - .14s)}
.st-running .ping{animation:ping 1s ease-out infinite}
.st-waiting .body-g,.st-idle .body-g{animation:breathe 2.4s ease-in-out infinite;animation-delay:var(--d)}
.st-waiting .pupil{animation:look 3.2s steps(1) infinite}
.st-waiting .dot{animation:blink 1.2s steps(1) infinite}
.st-waiting .dot2{animation-delay:.4s}.st-waiting .dot3{animation-delay:.8s}
.st-done .body-g{animation:hop .7s ease-out 1}
.st-idle .zz{animation:zz 2.4s ease-in-out infinite}
.st-idle .zz2{animation-delay:1.2s}
.flow{stroke-dasharray:4 4;animation:flow .7s linear infinite}
.slide{animation:slide 1.6s ease-in-out infinite}
.pulse{animation:pulse 1.1s ease-in-out infinite}
.st-running.prop-laptop .fl,.st-running.prop-laptop .fr{animation:tap .18s steps(2) infinite}
.st-running.prop-laptop .fr{animation-delay:-.09s}
.st-running.prop-laptop .body-g{animation-duration:.8s}
.glow{animation:glow .7s steps(2) infinite}
.st-running.prop-magnifier .mag{transform-box:fill-box;transform-origin:50% 100%;animation:sweep 1.4s ease-in-out infinite alternate}
.st-running.prop-magnifier .pupil{animation:look 1.4s steps(1) infinite}
.tired-1.st-running .body-g{animation-duration:.6s}
.tired-2 .body-g{animation-duration:1s}
.tired-3 .body-g{animation:slump 2.8s ease-in-out infinite}
.sweat{animation:drip 1.8s ease-in infinite}
.boom{animation:boom .9s ease-out forwards}
.blast{animation:blast .5s ease-out forwards}
@keyframes tap{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(2px)}}
@keyframes glow{0%,49%{opacity:.18}50%,100%{opacity:.35}}
@keyframes sweep{from{transform:rotate(-18deg)}to{transform:rotate(18deg)}}
@keyframes slump{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(1px) scaleY(.92)}}
@keyframes drip{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(7px);opacity:0}}
@keyframes boom{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}
@keyframes blast{0%{opacity:1}100%{opacity:0}}
@keyframes bob{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-2px)}}
@keyframes legs{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-1px)}}
@keyframes snapL{from{transform:rotate(0)}to{transform:rotate(-28deg)}}
@keyframes snapR{from{transform:rotate(0)}to{transform:rotate(28deg)}}
@keyframes breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.94)}}
@keyframes look{0%{transform:translateX(0)}33%{transform:translateX(-1px)}66%{transform:translateX(1px)}}
@keyframes blink{0%{opacity:.15}50%{opacity:1}}
@keyframes hop{0%{transform:translateY(0)}35%{transform:translateY(-7px)}60%{transform:translateY(0)}78%{transform:translateY(-2px)}100%{transform:translateY(0)}}
@keyframes ping{0%{opacity:1;r:2.5}100%{opacity:0;r:6}}
@keyframes zz{0%{opacity:0;transform:translate(0,0)}30%{opacity:1}100%{opacity:0;transform:translate(4px,-8px)}}
@keyframes flow{to{stroke-dashoffset:-8}}
@keyframes slide{0%{transform:translateX(-60px)}100%{transform:translateX(var(--w))}}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.95}}
`

const rect = (x: number, y: number, w: number, h: number, fill: string, cls = '', extra = ''): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${cls ? ` class="${cls}"` : ''}${extra}/>`

/** Mirror a rect across the crab's 44-wide frame. */
const mirror = (x: number, w: number) => 44 - x - w

export type CrabProp = 'laptop' | 'magnifier'

/** Extras: a tool it works with, and how tired it is (0 fresh … 3 exhausted). */
export type CrabOpts = { prop?: CrabProp; tired?: number }

/** One crab, 44×32 in its own units, drawn at (x, y) scaled by s. */
export function crab(x: number, y: number, s: number, color: string, st: CrabState, delay: number, opts: CrabOpts = {}): string {
  const failed = st === 'failed'
  const tired = failed || st === 'done' ? 0 : Math.max(0, Math.min(3, Math.round(opts.tired ?? 0)))
  const prop = st === 'running' ? opts.prop : undefined
  const body = failed ? '#9b9b9b' : tired === 3 ? mixGrey(color, 0.4) : tired === 2 ? mixGrey(color, 0.2) : color
  const dark = failed ? '#6b6b6b' : shade(color, -0.38)
  const light = shade(body, 0.35)
  const ink = '#2b2420'
  const p: string[] = []

  // legs
  const legs: [number, number, number, number, string][] = [
    [7, 25, 3, 6, 'legA'],
    [11, 26, 3, 6, 'legB'],
    [15, 26, 3, 5, 'legA'],
  ]
  for (const [lx, ly, lw, lh, cls] of legs) {
    p.push(rect(lx, ly, lw, lh, dark, cls))
    p.push(rect(mirror(lx, lw), ly, lw, lh, dark, cls === 'legA' ? 'legB' : 'legA'))
  }
  // claws: arm, palm, fixed finger, moving finger
  p.push(rect(6, 16, 5, 3, body), rect(mirror(6, 5), 16, 5, 3, body))
  p.push(rect(1, 10, 7, 6, body), rect(mirror(1, 7), 10, 7, 6, body))
  p.push(rect(5, 5, 3, 6, body), rect(mirror(5, 3), 5, 3, 6, body))
  p.push(rect(0, 3, 3, 8, dark, 'fing fl'), rect(mirror(0, 3), 3, 3, 8, dark, 'fing fr'))
  // shell
  p.push(rect(10, 12, 24, 15, body), rect(8, 14, 28, 11, body))
  p.push(rect(12, 14, 7, 2, light), rect(10, 24, 24, 3, dark, '', ' opacity=".35"'))
  // eye stalks and eyes
  p.push(rect(15, 7, 2, 6, body), rect(27, 7, 2, 6, body))
  if (st === 'done') {
    for (const ox of [0, 12]) {
      p.push(rect(13 + ox, 5, 2, 1, ink), rect(15 + ox, 4, 2, 1, ink), rect(17 + ox, 5, 2, 1, ink))
    }
  } else {
    p.push(rect(13, 2, 6, 6, '#ffffff'), rect(25, 2, 6, 6, '#ffffff'))
    if (failed) {
      p.push(
        `<path d="M14 3L18 7M18 3L14 7M26 3L30 7M30 3L26 7" stroke="${ink}" stroke-width="1.3"/>`,
      )
    } else {
      const py = prop === 'laptop' || tired >= 2 ? 5 : 4
      p.push(`<g class="pupil">${rect(15, py, 3, 3, ink)}${rect(27, py, 3, 3, ink)}</g>`)
      if (tired > 0) {
        // heavy eyelids, lower as it tires
        const lid = tired === 1 ? 2 : tired === 2 ? 3 : 4
        p.push(rect(13, 2, 6, lid, body), rect(25, 2, 6, lid, body))
        p.push(rect(13, 2 + lid, 6, 1, dark), rect(25, 2 + lid, 6, 1, dark))
      }
    }
  }
  // face
  p.push(rect(12, 19, 3, 2, '#ff9db0', '', ' opacity=".55"'), rect(29, 19, 3, 2, '#ff9db0', '', ' opacity=".55"'))
  if (tired >= 2) p.push(rect(19, 21, 2, 1, ink), rect(21, 20, 2, 1, ink), rect(23, 21, 2, 1, ink))
  else if (st === 'running') p.push(rect(20, 19, 4, 3, ink))
  else if (failed) p.push(rect(19, 21, 6, 1, ink), rect(18, 22, 1, 1, ink), rect(25, 22, 1, 1, ink))
  else p.push(rect(19, 21, 6, 1, ink), rect(18, 20, 1, 1, ink), rect(25, 20, 1, 1, ink))

  // what it works with, in front of it
  let tool = ''
  if (prop === 'laptop') {
    tool =
      `<rect class="glow" x="13" y="8" width="18" height="4" fill="#9fd3ff"/>` +
      rect(11, 15, 22, 11, '#4b5058') +
      rect(11, 15, 22, 1, '#8a9099') +
      rect(21, 19, 2, 2, MAIN_COLOR) +
      rect(8, 26, 28, 3, '#33363c') +
      rect(9, 26, 26, 1, '#5d626b')
  } else if (prop === 'magnifier') {
    tool =
      `<g class="mag"><rect x="4.2" y="7" width="2" height="6" fill="#6b4a2b"/>` +
      `<circle cx="5.2" cy="3.5" r="4" fill="#cfe8ff" fill-opacity=".35" stroke="#4a4f57" stroke-width="1.6"/>` +
      `<rect x="3" y="1.6" width="1.4" height="1.4" fill="#ffffff" opacity=".8"/></g>`
  }
  if (tired > 0) {
    tool += `<g class="sweat">${rect(35, 9, 2, 3, '#7fc8ff')}${rect(35.5, 8, 1, 1, '#7fc8ff')}</g>`
  }

  // badge, outside the bobbing body
  let badge = ''
  if (st === 'done') {
    badge = `<circle cx="41" cy="4" r="4.5" fill="#3fae6a"/><path d="M38.8 4.2l1.6 1.6 3-3.2" stroke="#fff" stroke-width="1.4" fill="none"/>`
  } else if (failed) {
    badge = `<circle cx="41" cy="4" r="4.5" fill="#d0473f"/>${rect(40.3, 1.5, 1.4, 3.4, '#fff')}${rect(40.3, 5.6, 1.4, 1.2, '#fff')}`
  } else if (st === 'running') {
    badge = `<circle cx="41" cy="4" r="2.5" fill="${color}"/><circle class="ping" cx="41" cy="4" r="2.5" fill="none" stroke="${color}" stroke-width="1"/>`
  } else if (st === 'waiting') {
    badge = [36, 40, 44]
      .map((cx, i) => `<circle class="dot dot${i + 1}" cx="${cx}" cy="3" r="1.3" fill="${dark}"/>`)
      .join('')
  } else if (st === 'idle') {
    badge = `<text class="zz" x="36" y="6" font-size="6" font-family="monospace" fill="#8a8a8a">z</text><text class="zz zz2" x="40" y="3" font-size="5" font-family="monospace" fill="#8a8a8a">z</text>`
  }

  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})">` +
    `<g class="crab st-${st}${prop ? ' prop-' + prop : ''}${tired ? ' tired-' + tired : ''}" style="--d:${(-delay).toFixed(2)}s">` +
    `<g class="body-g" shape-rendering="crispEdges">${p.join('')}</g>` +
    `<g shape-rendering="crispEdges">${tool}</g>${badge}</g></g>`
  )
}

export type TreeNode = {
  id: string
  parentId: string | null
  title: string
  subtitle: string
  color: string
  state: CrabState
  /** Usage drawn above the crab: a details line and a 0..1 bar. */
  usage?: { text: string; frac: number }
  opts?: CrabOpts
}

const PAD = 16
const INDENT = 56
const RH = 104
const CRAB_W = 44
const CRAB_H = 32
const TEXT_W = 230

/**
 * A retro segmented bar with its top-left at (x, y): the usage line on top,
 * a little crab beside the bar below it.
 */
function usageBlock(x: number, y: number, text: string, frac: number, color: string, st: CrabState, delay: number): string {
  const blocks = 10
  const bw = 10
  const gap = 2
  const barW = blocks * (bw + gap) - gap + 6
  const iconW = 27
  const barX = x + iconW + 6
  const barY = y + 22
  const filled = Math.max(0, Math.min(blocks, Math.round(frac * blocks)))
  const live = st === 'running'
  const fill = st === 'failed' ? '#9b9b9b' : color
  const cells: string[] = []
  for (let i = 0; i < blocks; i++) {
    const cx = barX + 3 + i * (bw + gap)
    const on = i < filled || (live && i === filled && filled < blocks)
    const cls = live && i === Math.min(filled, blocks - 1) ? ' class="pulse"' : ''
    cells.push(`<rect x="${cx}" y="${barY + 3}" width="${bw}" height="10" fill="${on ? fill : '#8a8a8a'}" opacity="${on ? 1 : 0.18}"${cls}/>`)
  }
  return (
    `<text x="${x}" y="${y + 13}" font-family="ui-monospace,Consolas,monospace" font-size="12" font-weight="600" fill="#8a8a8a">${esc(clip(text, 30))}</text>` +
    `<g shape-rendering="crispEdges">` +
    `<rect x="${barX}" y="${barY}" width="${barW}" height="16" fill="none" stroke="#8a8a8a" stroke-width="2" opacity=".75"/>` +
    cells.join('') +
    `</g>` +
    crab(x, barY - 3, 0.6, color, st, delay)
  )
}

/**
 * The agent tree, growing downward: one row per crab, each child indented
 * under its parent with a connector dropping from the parent's crab.
 */
export function treeSvg(root: TreeNode, nodes: TreeNode[]): { source: string; width: number; height: number } {
  const ids = new Set(nodes.map(n => n.id))
  const kids = new Map<string, TreeNode[]>()
  for (const n of nodes) {
    const parent = n.parentId !== null && ids.has(n.parentId) && n.parentId !== n.id ? n.parentId : root.id
    const list = kids.get(parent) ?? []
    list.push(n)
    kids.set(parent, list)
  }

  type Row = { node: TreeNode; depth: number; parent: Row | null; scale: number; x: number; y: number; w: number; h: number }
  const rows: Row[] = []
  const seen = new Set<string>()
  const visit = (node: TreeNode, depth: number, parent: Row | null) => {
    if (seen.has(node.id)) return
    seen.add(node.id)
    const scale = depth === 0 ? 1.35 : 1.15
    const w = CRAB_W * scale
    const h = CRAB_H * scale
    const row: Row = { node, depth, parent, scale, w, h, x: PAD + depth * INDENT, y: PAD + rows.length * RH + (RH - h) / 2 }
    rows.push(row)
    for (const child of kids.get(node.id) ?? []) visit(child, depth + 1, row)
  }
  visit(root, 0, null)
  // Anything left (a cycle in parent ids) hangs off the root.
  for (const n of nodes) if (!seen.has(n.id)) visit(n, 1, rows[0])

  const maxDepth = rows.reduce((m, r) => Math.max(m, r.depth), 0)
  const width = Math.ceil(PAD + maxDepth * INDENT + CRAB_W * 1.35 + 12 + TEXT_W + PAD)
  const height = PAD * 2 + rows.length * RH

  const edges = rows
    .filter(r => r.parent)
    .map(r => {
      const p = r.parent as Row
      const fromX = p.x + p.w / 2
      const fromY = p.y + p.h + 4
      const toY = r.y + r.h / 2
      const toX = r.x - 6
      const cls = r.node.state === 'running' ? ' class="flow"' : ''
      const op = r.node.state === 'done' ? '.5' : r.node.state === 'failed' ? '.35' : '.9'
      return `<path d="M${fromX.toFixed(1)} ${fromY.toFixed(1)}V${toY.toFixed(1)}H${toX.toFixed(1)}" fill="none" stroke="${r.node.color}" stroke-width="2.5" stroke-linecap="round" opacity="${op}"${cls}/>`
    })
    .join('')

  const bodies = rows
    .map((r, i) => {
      const delay = (i * 0.137) % 0.44
      const rowTop = PAD + i * RH
      const tx = r.x + r.w + 12
      const titleColor = r.node.state === 'failed' ? '#9b9b9b' : r.node.color
      const textRoom = Math.max(10, Math.floor((width - PAD - tx) / 7.5))
      const stripe = i % 2 === 1 ? `<rect x="0" y="${rowTop}" width="${width}" height="${RH}" fill="#8a8a8a" opacity=".06"/>` : ''
      const usage = r.node.usage
        ? usageBlock(tx, rowTop + 50, r.node.usage.text, r.node.usage.frac, r.node.color, r.node.state, (delay + 0.2) % 0.44)
        : ''
      return (
        stripe +
        crab(r.x, r.y, r.scale, r.node.color, r.node.state, delay, r.node.opts) +
        `<text x="${tx}" y="${rowTop + 24}" font-size="${r.depth === 0 ? 16 : 14}" font-weight="700" fill="${titleColor}">${esc(clip(r.node.title, textRoom))}</text>` +
        `<text x="${tx}" y="${rowTop + 42}" font-size="12" fill="#8a8a8a">${esc(clip(r.node.subtitle, textRoom + 4))}</text>` +
        usage
      )
    })
    .join('')

  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui,-apple-system,Segoe UI,sans-serif">` +
    `<style>${CSS}</style>` +
    edges +
    bodies +
    `</svg>`
  return { source, width, height }
}

export type Segment = { color: string; state: CrabState }

/** The band's bar: one segment per agent, a little crab walking at the front. */
export function progressSvg(segments: Segment[], isWorking: boolean, width = 240): string {
  const H = 24
  const barY = 14
  const barH = 8
  const parts: string[] = []
  parts.push(
    `<rect x="0" y="${barY}" width="${width}" height="${barH}" rx="4" fill="#8a8a8a" opacity=".22"/>`,
  )
  let crabX = 0
  let crabState: CrabState = isWorking ? 'running' : 'done'

  if (segments.length === 0) {
    if (isWorking) {
      parts.push(
        `<g class="slide" style="--w:${width + 10}px"><rect x="0" y="${barY}" width="56" height="${barH}" rx="4" fill="${MAIN_COLOR}"/>` +
          crab(38, 0, 0.42, MAIN_COLOR, 'running', 0) +
          `</g>`,
      )
      return wrap(parts, width, H)
    }
    parts.push(`<rect x="0" y="${barY}" width="${width}" height="${barH}" rx="4" fill="${MAIN_COLOR}"/>`)
    crabX = width - 19
  } else {
    const gap = 2
    const segW = (width - gap * (segments.length - 1)) / segments.length
    let finished = 0
    segments.forEach((seg, i) => {
      const x = i * (segW + gap)
      const fill = seg.state === 'failed' ? '#d0473f' : seg.color
      if (seg.state === 'done' || seg.state === 'failed') {
        finished += 1
        parts.push(`<rect x="${x.toFixed(1)}" y="${barY}" width="${segW.toFixed(1)}" height="${barH}" rx="3" fill="${fill}"/>`)
      } else {
        parts.push(
          `<rect x="${x.toFixed(1)}" y="${barY}" width="${segW.toFixed(1)}" height="${barH}" rx="3" fill="${fill}" opacity=".25"/>` +
            `<rect class="pulse" x="${x.toFixed(1)}" y="${barY}" width="${segW.toFixed(1)}" height="${barH}" rx="3" fill="${fill}"/>`,
        )
      }
    })
    const frac = finished / segments.length
    crabX = Math.max(0, Math.min(width - 19, frac * width - 10))
    if (finished === segments.length && !isWorking) crabState = 'done'
    else crabState = 'running'
  }
  parts.push(crab(crabX, 0, 0.42, MAIN_COLOR, crabState, 0))
  return wrap(parts, width, H)
}

const wrap = (parts: string[], width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 0 ${width + 4} ${height}" width="${width + 4}" height="${height}"><style>${CSS}</style>${parts.join('')}</svg>`

const RETRO_FONT = 'ui-monospace,Consolas,monospace'

/**
 * The band's bar: retro blocks filling to `frac`, the block at the front
 * glowing, a crab walking on top of the front. `null` while nothing says how
 * far the work is: a block scans back and forth.
 */
export function fillSvg(frac: number | null, isWorking: boolean, width = 300, tired = 0): string {
  const blocks = 24
  const gap = 2
  const barX = 0
  const barY = 14
  const barH = 16
  const bw = (width - 6 - gap * (blocks - 1)) / blocks
  const parts: string[] = []
  parts.push(`<rect x="${barX + 1}" y="${barY}" width="${width - 2}" height="${barH}" fill="none" stroke="#8a8a8a" stroke-width="2" opacity=".75"/>`)
  const f = frac === null ? null : Math.max(0, Math.min(1, frac))
  const exact = f === null ? 0 : f * blocks
  const full = Math.floor(exact)
  for (let i = 0; i < blocks; i++) {
    const x = barX + 3 + i * (bw + gap)
    let fill = '#8a8a8a'
    let op = 0.16
    let extra = ''
    if (f !== null && i < full) {
      fill = MAIN_COLOR
      op = 1
    } else if (f !== null && i === full && isWorking) {
      fill = MAIN_COLOR
      op = 0.35 + 0.6 * (exact - full)
      extra = ' class="pulse"'
    } else if (f === null && isWorking) {
      extra = ` class="pulse" style="animation-delay:${((i % 12) * 0.09).toFixed(2)}s"`
      fill = MAIN_COLOR
      op = 0.25
    }
    parts.push(`<rect x="${x.toFixed(1)}" y="${barY + 3}" width="${bw.toFixed(1)}" height="${barH - 6}" fill="${fill}" opacity="${op.toFixed(2)}"${extra}/>`)
  }
  const front = f === null ? 0.5 : f
  const crabX = Math.max(0, Math.min(width - 20, front * width - 10))
  parts.push(crab(crabX, 0, 0.42, MAIN_COLOR, isWorking ? 'running' : 'done', 0, { tired }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 30" width="${width}" height="30"><style>${CSS}</style><g shape-rendering="crispEdges">${parts.join('')}</g></svg>`
}

export const LIMIT_BLOCKS = 30

/** `lost`: block indexes that just went out, drawn bursting into pixels. */
export type LimitRow = { label: string; left: number | null; note: string; lost?: number[] }

/** One retro bar per usage limit: its name and what is left above, the bar below. */
export function limitsSvg(rows: LimitRow[], width = 460): string {
  const RH = 44
  const blocks = LIMIT_BLOCKS
  const gap = 2
  const bw = (width - 6 - gap * (blocks - 1)) / blocks
  const height = rows.length * RH
  const parts: string[] = []
  rows.forEach((r, i) => {
    const y = i * RH
    const left = r.left
    const color = left === null ? '#8a8a8a' : left > 50 ? '#6AAE5B' : left > 20 ? '#E0A33B' : '#d0473f'
    const filled = left === null ? 0 : Math.round((left / 100) * blocks)
    parts.push(`<text x="0" y="${y + 13}" font-family="${RETRO_FONT}" font-size="12" font-weight="700" fill="${left === null ? '#8a8a8a' : color}">${esc(r.label)}</text>`)
    parts.push(`<text x="${width}" y="${y + 13}" text-anchor="end" font-family="${RETRO_FONT}" font-size="11" fill="#8a8a8a">${esc(clip(r.note, 44))}</text>`)
    parts.push(`<rect x="1" y="${y + 19}" width="${width - 2}" height="16" fill="none" stroke="#8a8a8a" stroke-width="2" opacity=".75"/>`)
    for (let b = 0; b < blocks; b++) {
      const x = 3 + b * (bw + gap)
      const on = b < filled
      parts.push(`<rect x="${x.toFixed(1)}" y="${y + 22}" width="${bw.toFixed(1)}" height="10" fill="${on ? color : '#8a8a8a'}" opacity="${on ? 1 : 0.16}"/>`)
      if (r.lost?.includes(b)) parts.push(burst(x, y + 22, bw, 10, color, b))
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" overflow="visible"><style>${CSS}</style><g shape-rendering="crispEdges">${parts.join('')}</g></svg>`
}

/** A block bursting: a white flash, then its pixels flying off and fading. */
function burst(x: number, y: number, w: number, h: number, color: string, seed: number): string {
  const out = [`<rect class="blast" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" fill="#ffffff"/>`]
  const dirs = [
    [-9, -10], [-3, -14], [4, -12], [10, -8], [-11, 2], [12, 3], [-6, 9], [7, 10],
  ]
  dirs.forEach(([dx, dy], i) => {
    const jx = ((seed * 7 + i * 3) % 5) - 2
    const px = x + (i % 4) * (w / 4)
    const py = y + (i < 4 ? 1 : 6)
    out.push(
      `<rect class="boom" x="${px.toFixed(1)}" y="${py}" width="3" height="3" fill="${i % 3 === 0 ? '#ffffff' : color}" style="--dx:${dx + jx}px;--dy:${dy}px;animation-delay:${(i * 0.02).toFixed(2)}s"/>`,
    )
  })
  return out.join('')
}
