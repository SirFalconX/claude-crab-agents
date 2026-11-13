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

/** One crab, 44×32 in its own units, drawn at (x, y) scaled by s. */
export function crab(x: number, y: number, s: number, color: string, st: CrabState, delay: number): string {
  const failed = st === 'failed'
  const body = failed ? '#9b9b9b' : color
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
      p.push(`<g class="pupil">${rect(15, 4, 3, 3, ink)}${rect(27, 4, 3, 3, ink)}</g>`)
    }
  }
  // face
  p.push(rect(12, 19, 3, 2, '#ff9db0', '', ' opacity=".55"'), rect(29, 19, 3, 2, '#ff9db0', '', ' opacity=".55"'))
  if (st === 'running') p.push(rect(20, 19, 4, 3, ink))
  else if (failed) p.push(rect(19, 21, 6, 1, ink), rect(18, 22, 1, 1, ink), rect(25, 22, 1, 1, ink))
  else p.push(rect(19, 21, 6, 1, ink), rect(18, 20, 1, 1, ink), rect(25, 20, 1, 1, ink))

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
    `<g class="crab st-${st}" style="--d:${(-delay).toFixed(2)}s">` +
    `<g class="body-g" shape-rendering="crispEdges">${p.join('')}</g>${badge}</g></g>`
  )
}

export type TreeNode = {
  id: string
  parentId: string | null
  title: string
  subtitle: string
  color: string
  state: CrabState
}

const CW = 140
const LH = 104
const CRAB_W = 44
const CRAB_H = 32

/** The whole agent tree: `root` on top, every node under its parent. */
export function treeSvg(root: TreeNode, nodes: TreeNode[]): { source: string; width: number; height: number } {
  const ids = new Set(nodes.map(n => n.id))
  const kids = new Map<string, TreeNode[]>()
  for (const n of nodes) {
    const parent = n.parentId !== null && ids.has(n.parentId) ? n.parentId : root.id
    const list = kids.get(parent) ?? []
    list.push(n)
    kids.set(parent, list)
  }
  const leaves = new Map<string, number>()
  const countLeaves = (id: string): number => {
    const k = kids.get(id) ?? []
    const c = k.length === 0 ? 1 : k.reduce((sum, n) => sum + countLeaves(n.id), 0)
    leaves.set(id, c)
    return c
  }
  const total = countLeaves(root.id)

  type Placed = { node: TreeNode; cx: number; y: number; depth: number; scale: number }
  const placed: Placed[] = []
  const edges: string[] = []
  let maxDepth = 0
  const place = (node: TreeNode, start: number, depth: number, parent: Placed | null, index: number) => {
    const span = leaves.get(node.id) ?? 1
    const scale = depth === 0 ? 1.45 : 1.15
    const me: Placed = { node, cx: (start + span / 2) * CW, y: 14 + depth * LH, depth, scale }
    placed.push(me)
    maxDepth = Math.max(maxDepth, depth)
    if (parent) {
      const fromY = parent.y + CRAB_H * parent.scale + 30
      const toY = me.y - 6
      const midY = (fromY + toY) / 2
      const cls = node.state === 'running' ? ' class="flow"' : ''
      const op = node.state === 'done' ? '.45' : node.state === 'failed' ? '.35' : '.85'
      edges.push(
        `<path d="M${parent.cx} ${fromY}V${midY}H${me.cx}V${toY}" fill="none" stroke="${node.color}" stroke-width="2" stroke-linecap="round" opacity="${op}"${cls}/>`,
      )
    }
    let offset = start
    ;(kids.get(node.id) ?? []).forEach((child, i) => {
      place(child, offset, depth + 1, me, index * 7 + i + 1)
      offset += leaves.get(child.id) ?? 1
    })
  }
  place(root, 0, 0, null, 0)

  const width = Math.max(total * CW, CW * 2)
  const height = 14 + (maxDepth + 1) * LH
  const shift = (width - total * CW) / 2

  const bodies = placed
    .map((p, i) => {
      const cx = p.cx + shift
      const w = CRAB_W * p.scale
      const h = CRAB_H * p.scale
      const ty = p.y + h + 13
      const titleColor = p.node.state === 'failed' ? '#9b9b9b' : p.node.color
      return (
        crab(cx - w / 2, p.y, p.scale, p.node.color, p.node.state, (i * 0.137) % 0.44) +
        `<text x="${cx}" y="${ty}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${titleColor}">${esc(clip(p.node.title, 20))}</text>` +
        `<text x="${cx}" y="${ty + 13}" text-anchor="middle" font-size="10" fill="#8a8a8a">${esc(clip(p.node.subtitle, 24))}</text>`
      )
    })
    .join('')

  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui,-apple-system,Segoe UI,sans-serif">` +
    `<style>${CSS}</style>` +
    `<g transform="translate(${shift} 0)">${edges.join('')}</g>` +
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
