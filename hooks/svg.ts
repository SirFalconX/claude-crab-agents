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
.crab .eyes{transform-box:fill-box;transform-origin:50% 50%;animation:blinkEye 4.2s infinite;animation-delay:var(--d)}
.crab .leg{transform-box:fill-box;transform-origin:50% 0%}
.crab .arm{transform-box:fill-box}
.crab .armL{transform-origin:100% 50%}
.crab .armR{transform-origin:0% 50%}
.st-running .body-g{animation:bob .5s ease-in-out infinite;animation-delay:var(--d)}
.st-running .legA{animation:step .5s steps(2) infinite;animation-delay:var(--d)}
.st-running .legB{animation:step .5s steps(2) infinite;animation-delay:calc(var(--d) - .25s)}
.st-running .armL{animation:waveL .5s ease-in-out infinite alternate;animation-delay:var(--d)}
.st-running .armR{animation:waveR .5s ease-in-out infinite alternate;animation-delay:calc(var(--d) - .25s)}
.st-running .ping{animation:ping 1s ease-out infinite}
.st-waiting .body-g,.st-idle .body-g{animation:breathe 2.6s ease-in-out infinite;animation-delay:var(--d)}
.st-waiting .eyes{animation:look 3.2s steps(1) infinite}
.st-waiting .dot{animation:blink 1.2s steps(1) infinite}
.st-waiting .dot2{animation-delay:.4s}.st-waiting .dot3{animation-delay:.8s}
.st-done .body-g{animation:hop .8s cubic-bezier(.3,1.6,.5,1) 1}
.st-done .eyes{animation:none}
.st-idle .zz{animation:zz 2.4s ease-in-out infinite}
.st-idle .zz2{animation-delay:1.2s}
.prop-laptop.st-running .body-g{animation:type-bob .36s ease-in-out infinite}
.prop-laptop.st-running .legA,.prop-laptop.st-running .legB{animation:none}
.prop-laptop .eyes{transform:translateY(1px)}
.prop-laptop.st-running .eyes{animation:readEye 1.6s steps(1) infinite}
.handL{animation:tapKey .24s steps(2) infinite}
.handR{animation:tapKey .24s steps(2) infinite;animation-delay:-.12s}
.keyflash{animation:keyflash .24s steps(2) infinite}
.keyflash2{animation-delay:-.12s}
.glow{animation:glow .7s steps(2) infinite}
.codeline{animation:codeline 1.2s steps(6) infinite}
.prop-magnifier.st-running .legA,.prop-magnifier.st-running .legB{animation-duration:.8s}
.prop-magnifier.st-running .eyes{animation:look 1.4s steps(1) infinite}
.tired-1.st-running .body-g{animation-duration:.7s}
.tired-2 .body-g{animation-duration:1.1s}
.tired-3 .body-g{animation:slump 2.8s ease-in-out infinite}
.tired-2 .eyes,.tired-3 .eyes{animation:none}
.sweat{animation:drip 1.8s ease-in infinite}
.flow{stroke-dasharray:4 4;animation:flow .7s linear infinite}
.slide{animation:slide 1.6s ease-in-out infinite}
.pulse{animation:pulse 1.1s ease-in-out infinite}
.boom{animation:boom .9s ease-out forwards}
.blast{animation:blast .5s ease-out forwards}
@keyframes bob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-2px) scale(.97,1.03)}}
@keyframes type-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(.6px)}}
@keyframes step{0%,49%{transform:translateY(0) scaleY(1)}50%,100%{transform:translateY(-1px) scaleY(.8)}}
@keyframes waveL{from{transform:translateY(0)}to{transform:translateY(-3px)}}
@keyframes waveR{from{transform:translateY(0)}to{transform:translateY(-3px)}}
@keyframes tapKey{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-2px)}}
@keyframes keyflash{0%,49%{opacity:.9}50%,100%{opacity:0}}
@keyframes readEye{0%{transform:translate(0,1px)}50%{transform:translate(1px,1px)}}
@keyframes codeline{from{transform:translateX(0)}to{transform:translateX(-6px)}}
@keyframes blinkEye{0%,93%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,.95)}}
@keyframes look{0%{transform:translateX(0)}33%{transform:translateX(-1.5px)}66%{transform:translateX(1.5px)}}
@keyframes blink{0%{opacity:.15}50%{opacity:1}}
@keyframes hop{0%{transform:translateY(0) scale(1,1)}20%{transform:translateY(0) scale(1.1,.85)}45%{transform:translateY(-8px) scale(.92,1.1)}70%{transform:translateY(0) scale(1.08,.9)}100%{transform:translateY(0) scale(1,1)}}
@keyframes slump{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(1px) scaleY(.92)}}
@keyframes drip{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(7px);opacity:0}}
@keyframes glow{0%,49%{opacity:.18}50%,100%{opacity:.32}}
@keyframes ping{0%{opacity:1;r:2.5}100%{opacity:0;r:6}}
@keyframes zz{0%{opacity:0;transform:translate(0,0)}30%{opacity:1}100%{opacity:0;transform:translate(4px,-8px)}}
@keyframes flow{to{stroke-dashoffset:-8}}
@keyframes slide{0%{transform:translateX(-60px)}100%{transform:translateX(var(--w))}}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:.95}}
@keyframes boom{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}
@keyframes blast{0%{opacity:1}100%{opacity:0}}
`

const rect = (x: number, y: number, w: number, h: number, fill: string, cls = '', extra = ''): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${cls ? ` class="${cls}"` : ''}${extra}/>`

export type CrabProp = 'laptop' | 'magnifier'

/** Extras: a tool it works with, and how tired it is (0 fresh … 3 exhausted). */
export type CrabOpts = { prop?: CrabProp; tired?: number }

/**
 * One crab in the Claude Code mascot's style: a wide orange block, two tall
 * dark eyes, stubby arms at its sides and four short legs. 44×32 in its own
 * units, drawn at (x, y) scaled by s. While it works it holds its tool with
 * its arms: typing on a laptop, or raising a magnifier.
 */
export function crab(x: number, y: number, s: number, color: string, st: CrabState, delay: number, opts: CrabOpts = {}): string {
  const failed = st === 'failed'
  const tired = failed || st === 'done' ? 0 : Math.max(0, Math.min(3, Math.round(opts.tired ?? 0)))
  const prop = st === 'running' ? opts.prop : undefined
  const body = failed ? '#9b9b9b' : tired === 3 ? mixGrey(color, 0.4) : tired === 2 ? mixGrey(color, 0.2) : color
  const dark = failed ? '#6b6b6b' : shade(body, -0.32)
  const light = shade(body, 0.28)
  const ink = '#1f1a17'
  const p: string[] = []

  // legs: four short stubs
  ;[10, 16, 25, 31].forEach((lx, i) => p.push(rect(lx, 22, 3, 7, body, `leg ${i % 2 === 0 ? 'legA' : 'legB'}`)))
  // body block, with a soft top light and a shaded base
  p.push(rect(6, 6, 32, 17, body))
  p.push(rect(8, 7, 28, 1.5, light, '', ' opacity=".55"'))
  p.push(rect(6, 21, 32, 2, dark, '', ' opacity=".45"'))

  // eyes
  if (st === 'done') {
    for (const ox of [0, 15]) p.push(rect(12 + ox, 13, 2, 2, ink), rect(14 + ox, 11, 2, 2, ink), rect(16 + ox, 13, 2, 2, ink))
  } else if (failed) {
    p.push(`<path d="M12 10L17 15M17 10L12 15M27 10L32 15M32 10L27 15" stroke="${ink}" stroke-width="1.6"/>`)
  } else {
    const lid = tired === 1 ? 2 : tired === 2 ? 3 : tired === 3 ? 4 : 0
    let eyes = rect(13, 10, 3, 6, ink) + rect(28, 10, 3, 6, ink)
    if (lid > 0) eyes += rect(13, 10, 3, lid, body) + rect(28, 10, 3, lid, body)
    p.push(`<g class="eyes">${eyes}</g>`)
  }

  // arms and what they hold
  const arms: string[] = []
  const front: string[] = []
  if (prop === 'laptop') {
    // laptop in front: lid back with a glowing edge, keyboard base; both hands typing on it
    front.push(`<rect class="glow" x="10" y="15" width="24" height="2" fill="#9fd3ff"/>`)
    front.push(rect(12, 17, 20, 8, '#4b5058'), rect(12, 17, 20, 1, '#8a9099'))
    front.push(rect(21, 20, 2, 2, MAIN_COLOR))
    front.push(rect(6, 25, 32, 4, '#33363c'), rect(7, 25, 30, 1, '#5d626b'))
    front.push(rect(10, 26.5, 3, 1, '#9fd3ff', 'keyflash'), rect(31, 26.5, 3, 1, '#9fd3ff', 'keyflash keyflash2'))
    // shoulders at the sides, forearms down onto the keys
    arms.push(rect(2, 16, 4, 4, body), rect(38, 16, 4, 4, body))
    front.push(`<g class="handL">${rect(3, 19, 4, 3, body)}${rect(5, 21, 6, 4, body)}${rect(5, 24, 6, 1, dark)}</g>`)
    front.push(`<g class="handR">${rect(37, 19, 4, 3, body)}${rect(33, 21, 6, 4, body)}${rect(33, 24, 6, 1, dark)}</g>`)
  } else if (prop === 'magnifier') {
    // The right hand holds the lens up to the right eye, which shows big
    // through the glass. Two routines, picked per crab: peer and scan, then
    // check the ground; or peer, then hold it up to look around above.
    const variant = Math.round(delay * 100) % 2
    const begin = `${(-delay * 7).toFixed(2)}s`
    const move =
      variant === 0
        ? `<animateTransform attributeName="transform" type="translate" values="0 0;-1.5 0;1.5 0;0 0;-8 11;-14 11;-8 11;0 0" keyTimes="0;.12;.24;.36;.52;.66;.8;1" dur="6s" begin="${begin}" repeatCount="indefinite"/>`
        : `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;-3 -1;-3 -1;0 0;2 -9;-4 -9;0 0" keyTimes="0;.1;.25;.4;.55;.7;.85;1" dur="5.4s" begin="${begin}" repeatCount="indefinite"/>`
    const show =
      variant === 0
        ? `<animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;.38;.44;.88;.96;1" dur="6s" begin="${begin}" repeatCount="indefinite"/>`
        : `<animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;.58;.63;.88;.96;1" dur="5.4s" begin="${begin}" repeatCount="indefinite"/>`
    arms.push(`<g class="arm armL">${rect(1, 17, 5, 4, body)}</g>`)
    arms.push(rect(38, 17, 4, 5, body))
    front.push(
      `<g>${move}` +
        `<path d="M33.4 17.4L37 21" stroke="#6b4a2b" stroke-width="2.2" stroke-linecap="square"/>` +
        `<circle cx="29.5" cy="13" r="5.6" fill="#cfe8ff" fill-opacity=".22"/>` +
        `<g>${show}${rect(27.4, 8.6, 4.2, 8.8, ink)}${rect(28.1, 9.4, 1.4, 1.4, '#ffffff')}</g>` +
        `<circle cx="29.5" cy="13" r="5.6" fill="none" stroke="#3f444c" stroke-width="1.6"/>` +
        `<rect x="25.6" y="9.2" width="1.4" height="1.4" fill="#ffffff" opacity=".75"/>` +
        rect(35.5, 19.5, 5, 4.5, body) +
        rect(35.5, 23, 5, 1, dark) +
        `</g>`,
    )
  } else if (st === 'done') {
    // arms up in a cheer
    arms.push(rect(2, 6, 4, 7, body), rect(38, 6, 4, 7, body))
  } else if (failed) {
    arms.push(rect(2, 18, 4, 5, body), rect(38, 18, 4, 5, body))
  } else {
    arms.push(`<g class="arm armL">${rect(1, 17, 5, 4, body)}</g>`, `<g class="arm armR">${rect(38, 17, 5, 4, body)}</g>`)
  }

  let extras = ''
  if (tired > 0) extras += `<g class="sweat">${rect(35, 3, 2, 3, '#7fc8ff')}${rect(35.5, 2, 1, 1, '#7fc8ff')}</g>`

  // badge, outside the bobbing body
  let badge = ''
  if (st === 'done') {
    badge = `<circle cx="41" cy="3" r="4.5" fill="#3fae6a"/><path d="M38.8 3.2l1.6 1.6 3-3.2" stroke="#fff" stroke-width="1.4" fill="none"/>`
  } else if (failed) {
    badge = `<circle cx="41" cy="3" r="4.5" fill="#d0473f"/>${rect(40.3, 0.5, 1.4, 3.4, '#fff')}${rect(40.3, 4.6, 1.4, 1.2, '#fff')}`
  } else if (st === 'running') {
    badge = `<circle cx="41" cy="3" r="2.5" fill="${color}"/><circle class="ping" cx="41" cy="3" r="2.5" fill="none" stroke="${color}" stroke-width="1"/>`
  } else if (st === 'waiting') {
    badge = [36, 40, 44].map((cx, i) => `<circle class="dot dot${i + 1}" cx="${cx}" cy="2" r="1.3" fill="${dark}"/>`).join('')
  } else if (st === 'idle') {
    badge = `<text class="zz" x="36" y="5" font-size="6" font-family="monospace" fill="#8a8a8a">z</text><text class="zz zz2" x="40" y="2" font-size="5" font-family="monospace" fill="#8a8a8a">z</text>`
  }

  return (
    `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})">` +
    `<g class="crab st-${st}${prop ? ' prop-' + prop : ''}${tired ? ' tired-' + tired : ''}" style="--d:${(-delay).toFixed(2)}s">` +
    `<g class="body-g" shape-rendering="crispEdges">${p.join('')}${arms.join('')}${extras}</g>` +
    `<g shape-rendering="crispEdges">${front.join('')}</g>${badge}</g></g>`
  )
}

export type TreeNode = {
  id: string
  parentId: string | null
  title: string
  /** Shown after the title, smaller: model and effort. */
  meta?: string
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
const TEXT_W = 310

/**
 * A retro segmented bar with its top-left at (x, y): the usage line on top,
 * a little crab beside the bar below it.
 */
function usageBlock(x: number, y: number, text: string, frac: number, color: string, st: CrabState, delay: number): string {
  const blocks = 10
  const bw = 10
  const gap = 2
  const barW = blocks * (bw + gap) - gap + 6
  const barX = x
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
    `</g>`
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
        `<text x="${tx}" y="${rowTop + 24}" font-size="${r.depth === 0 ? 16 : 14}" font-weight="700" fill="${titleColor}">${esc(clip(r.node.title, textRoom))}${r.node.meta ? `<tspan font-size="12" font-weight="500" fill="#8a8a8a" dx="6">${esc(r.node.meta)}</tspan>` : ''}</text>` +
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
