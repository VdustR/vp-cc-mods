// A calm sea seen from above. One hammerhead, a pure silhouette, cruises a wide loop while slow ribbons of
// light cross the water over it.
//
// The shark is a chain of overlapping segments, each hinged on the one before: body, middle, rear, the stalk of
// the tail, and the two lobes of its fin. Every hinge swings on the same slow beat, each a little later and a little wider than the one before
// it, so a wave travels down the body and the tail sweeps a clear S. The head sweeps the other way, as a
// hammerhead's does. The route is a CSS motion path with `offset-rotate: auto`, so the shark faces where it goes,
// and it banks into the route's turns: the inner pectoral shortens and the outer one lengthens.
//
// The water is drawn as ribbons: bands between two sine curves, each with its own wavelength, height, speed and
// direction, each also rising and falling on its own period, so their overlaps keep changing.
// A ribbon's crest line fades in and out along its length, so it reads as light on water and not as a contour.
//
// No script, no filter, no blend mode: an animated SVG image repaints every frame, and those cost the most.
// The surface tells a scene nothing about light or dark, so the SVG carries both palettes, each worked out from
// that mode's scheme, and switches between them with a media query. All motion stops when the system asks for
// reduced motion.

import type { Sea } from './look'

/** What a scene is drawn with, beside its seed. */
export type SceneLook = {
  dark: Sea
  light: Sea
  /** The shark's size, where 1 is its own. */
  size: number
  /** How fast the shark swims and beats its tail, where 1 is its own pace. */
  speed: number
  isSharkShown: boolean
  /** How many ribbons cross the water. */
  waves: number
  /** Whether specks of light twinkle on the water. */
  glints: number
  /** How fast the ribbons drift, where 1 is their own pace. */
  waveSpeed: number
  /** False rests everything in place, as reduced motion does. */
  isMoving: boolean
  /**
   * True draws the still sea a shader plays over (sea.ts): the shark and the ribbons are the shader's to draw, so
   * the SVG shows its own only where the app shows the SVG alone because the system asks for reduced motion.
   */
  isUnderShader?: boolean
}

function palette(sea: Sea): string {
  return `--deep: ${sea.deep}; --mid: ${sea.mid}; --shallow: ${sea.shallow}; --glow: ${sea.glow};
  --light: ${sea.light}; --band-o: ${sea.bandOpacity}; --crest-o: ${sea.crestOpacity};
  --shark: ${sea.shark}; --shark-o: ${sea.sharkOpacity};
  --shadow: ${sea.shadow}; --shadow-o: ${sea.shadowOpacity};
  --speck: ${sea.speck}; --speck-o: ${sea.speckOpacity};`
}

type Point = readonly [number, number]

/** A seeded generator: the same seed draws the same sea. */
function rng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1

  return () => {
    s = (s * 16807) % 2147483647

    return (s - 1) / 2147483646
  }
}

/** A smooth closed loop through the points (Catmull-Rom turned into cubic Béziers). */
function loop(points: readonly Point[], dx = 0, dy = 0): string {
  const n = points.length
  const at = (i: number): Point => {
    const p = points[((i % n) + n) % n]!

    return [p[0] + dx, p[1] + dy]
  }
  let d = `M${at(0)[0]} ${at(0)[1]}`
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1)
    const [x1, y1] = at(i)
    const [x2, y2] = at(i + 1)
    const [x3, y3] = at(i + 2)
    d += ` C${(x1 + (x2 - x0) / 6).toFixed(0)} ${(y1 + (y2 - y0) / 6).toFixed(0)} ${(x2 - (x3 - x1) / 6).toFixed(0)} ${(y2 - (y3 - y1) / 6).toFixed(0)} ${x2} ${y2}`
  }

  return `${d} Z`
}

/**
 * How hard a route turns at equal steps of its length, one number a step: 0 on a straight, up to 1 in a tight turn
 * to the shark's left (the side of smaller y when it faces +x) and down to -1 in one to its right.
 *
 * The route is walked as the same curve `loop` draws, in small straight pieces, so a step here is a step of the
 * shark's `offset-distance`.
 */
function turns(points: readonly Point[], steps: number): number[] {
  const n = points.length
  const at = (i: number): Point => points[((i % n) + n) % n]!
  const walk: Point[] = []
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1)
    const [x1, y1] = at(i)
    const [x2, y2] = at(i + 1)
    const [x3, y3] = at(i + 2)
    const c1: Point = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6]
    const c2: Point = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6]
    for (let piece = 0; piece < 24; piece++) {
      const t = piece / 24
      const u = 1 - t
      walk.push([
        u * u * u * x1 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x2,
        u * u * u * y1 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y2,
      ])
    }
  }
  const far: number[] = [0]
  for (let i = 1; i <= walk.length; i++) {
    const [ax, ay] = walk[i - 1]!
    const [bx, by] = walk[i % walk.length]!
    far.push(far[i - 1]! + Math.hypot(bx - ax, by - ay))
  }
  const total = far[walk.length]!
  /** The point a distance along the route, wrapping round. */
  const point = (distance: number): Point => {
    const d = ((distance % total) + total) % total
    let i = 0
    while (far[i + 1]! < d) i++

    return walk[i % walk.length]!
  }
  // The heading a little behind and a little ahead: their difference over that reach is the turn.
  const reach = total / steps
  const out: number[] = []
  for (let step = 0; step < steps; step++) {
    const here = (total * step) / steps
    const [bx, by] = point(here - reach)
    const [mx, my] = point(here)
    const [fx, fy] = point(here + reach)
    const before = Math.atan2(my - by, mx - bx)
    const after = Math.atan2(fy - my, fx - mx)
    const turn = Math.atan2(Math.sin(after - before), Math.cos(after - before))
    // A turn of radius 260 or tighter is a full bank. With y down the screen, a turn to the left is a falling angle.
    out.push(+Math.max(-1, Math.min(1, (-turn / reach) * 260)).toFixed(2))
  }

  return out
}

/**
 * A random closed route around the middle of the window. Its points go round in angle order, so the loop never
 * crosses itself. The loop stays inside the middle of the drawing, where the conversation is: the app's sidebar
 * and side pane cover the drawing's left and right, and a shark that swam under them was out of sight for most of
 * a lap.
 */
function route(rand: () => number): Point[] {
  const count = 7 + Math.floor(rand() * 3)
  const start = rand() * Math.PI * 2
  const points: Point[] = []
  for (let i = 0; i < count; i++) {
    const a = start + ((i + (rand() - 0.5) * 0.5) / count) * Math.PI * 2
    const r = 260 + rand() * 300
    // At its widest the loop spans the middle three fifths of the drawing's width and four fifths of its height.
    points.push([Math.round(800 + Math.cos(a) * r * 0.85), Math.round(500 + Math.sin(a) * r * 0.72)])
  }

  return rand() < 0.5 ? points.reverse() : points
}

function length(points: readonly Point[]): number {
  let total = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]!
    const [x1, y1] = points[(i + 1) % points.length]!
    total += Math.hypot(x1 - x0, y1 - y0)
  }

  return total
}

// The hammerhead, nose toward +x, about 480 long. Each part overlaps the next, so a hinge never opens a gap.
// A part is one path or several: a fin is its own path beside the trunk, never a subpath of it. The two fins of a
// pair are mirror images, so they wind opposite ways, and inside one path the trunk would cut a slit into one.
type Part = readonly string[]

/**
 * The cephalofoil, as a great hammerhead's reads from above: a short, broad hammer set straight on the body, which
 * runs into it at its full width with no neck. Its front edge bows gently forward, and each end is a flat block
 * that stands a little proud of the wing, both forward and back.
 */
const HEAD: Part = [
  'M152.5 0 C152.5 -8 151.8 -18 150.3 -27 C149.4 -33 148.6 -38 148.8 -43 C149.2 -47 150.5 -50 153 -53 C156 -56 157.5 -63 154 -66.5 C151.5 -69.5 146 -70.5 138 -70.5 C130 -70.5 122 -70.5 116 -70 C111 -69.5 107.5 -65 109 -60 C110 -54 121 -50 123 -44 C124 -37 116 -32 108 -30 C101 -28.6 94 -28.8 86 -29 L86 29 C94 28.8 101 28.6 108 30 C116 32 124 37 123 44 C121 50 110 54 109 60 C107.5 65 111 69.5 116 70 C122 70.5 130 70.5 138 70.5 C146 70.5 151.5 69.5 154 66.5 C157.5 63 156 56 153 53 C150.5 50 149.2 47 148.8 43 C148.6 38 149.4 33 150.3 27 C151.8 18 152.5 8 152.5 0 Z',
]
/**
 * The front of the body: a wedge, deepest just behind the head, where a hammerhead carries its bulk, and tapering
 * from there all the way to the tail.
 */
const BODY: Part = [
  'M94 -28.8 C78 -32 58 -34 36 -33.5 C14 -33 -8 -31 -26 -28.5 L-26 28.5 C-8 31 14 33 36 33.5 C58 34 78 32 94 28.8 Z',
]
// The pectorals are angled down from the body, so when the shark banks into a turn the inner one drops away and
// looks shorter from above while the outer one flattens and looks longer. Each scales across the body about its
// own root, on keyframes baked from the route's turns.
//
// From above a hammerhead's pectorals are delta wings, not swept leaves: a root as broad as the body is deep, a
// leading edge that sweeps back to a point, and a trailing edge that is hollow and stands near square to the body.
// The broad root is what makes the shark look powerful; a narrow, swept fin reads as a glider.
const PECTORALS = [
  { side: 'left', root: -27, d: 'M70 -27 C58 -46 38 -76 8 -98 C12 -76 12 -50 14 -28 Z' },
  { side: 'right', root: 27, d: 'M70 27 C58 46 38 76 8 98 C12 76 12 50 14 28 Z' },
] as const
const MIDDLE: Part = ['M-6 -30.5 C-34 -28 -62 -22.5 -88 -16 L-88 16 C-62 22.5 -34 28 -6 30.5 Z']
/** The rear of the body, narrowing to the stalk, with the pelvic fins: small deltas of the pectorals' cut. */
const REAR: Part = [
  'M-70 -19.5 C-100 -14 -128 -8.5 -154 -5 L-154 5 C-128 8.5 -100 14 -70 19.5 Z',
  'M-84 -16 C-96 -24 -110 -33 -126 -40 C-124 -30 -120 -20 -112 -10 Z',
  'M-84 16 C-96 24 -110 33 -126 40 C-124 30 -120 20 -112 10 Z',
]
/** The stalk of the tail. */
const STALK: Part = ['M-142 -6 C-172 -5.4 -202 -4.2 -232 -2.8 L-232 2.8 C-202 4.2 -172 5.4 -142 6 Z']
// The caudal fin is a tall blade with a long upper lobe and a short lower one. From straight above the two lie on
// one line. As the tail sweeps, the water leans the blade over, and a leaning blade shows its upper lobe to one
// side and its lower lobe to the other. So each lobe is its own hinge on the end of the stalk, and they swing
// opposite ways on the same beat: the fork opens as the tail sweeps and closes as the blade stands up again.
// The upper lobe is a scythe: it runs out to a point.
const UPPER_LOBE: Part = ['M-220 -3.2 C-250 -6.5 -296 -10 -352 -2 C-300 5.5 -250 4.8 -220 3.2 Z']
const LOWER_LOBE: Part = ['M-220 -3 C-236 -5 -262 -6.4 -290 0 C-262 5 -236 4.2 -220 3 Z']

/** The hinges, from the body back: where each turns, how far, and how late in the beat. */
const HINGES = [
  { part: MIDDLE, x: -16, swing: 4.5, lag: 0.14 },
  { part: REAR, x: -80, swing: 6.5, lag: 0.28 },
  { part: STALK, x: -148, swing: 9, lag: 0.42 },
] as const

/** The two lobes of the caudal fin, each hinged where the stalk ends. */
const LOBES = [
  { part: UPPER_LOBE, x: -224, swing: 9, lag: 0.68 },
  { part: LOWER_LOBE, x: -224, swing: -7, lag: 0.68 },
] as const

function paths(part: Part): string {
  return part.map(d => `<path d="${d}"/>`).join('')
}

/** One hinge: a group that swings about a point on the body's axis, a share of a beat behind the head. */
function hinge(x: number, swing: number, lag: number, beat: number, inside: string): string {
  return `<g class="hinge" style="transform-origin:${x}px 0;--swing:${swing}deg;animation-duration:${beat / 2}s;animation-delay:${(-beat * (1 - lag)).toFixed(2)}s">${inside}</g>`
}

/** The shark's outline, every hinge beating; `beat` is one full sweep, there and back, in seconds. */
function shark(beat: number, lap: string): string {
  let chain = LOBES.map(lobe => hinge(lobe.x, lobe.swing, lobe.lag, beat, paths(lobe.part))).join('')
  for (const part of [...HINGES].reverse()) {
    chain = hinge(part.x, part.swing, part.lag, beat, paths(part.part) + chain)
  }

  // The whole body yaws a little against the tail, and the head sweeps against the body.
  const fins = PECTORALS.map(fin => `<g class="bank ${fin.side}" style="transform-origin:20px ${fin.root}px;${lap}"><path d="${fin.d}"/></g>`).join('')

  return hinge(20, -2, 0.08, beat, `${chain}${fins}${paths(BODY)}${hinge(66, -3.5, 0.16, beat, paths(HEAD))}`)
}

/** A sine curve as a smooth path: sampled a tenth of a wave apart and joined through the midpoints. */
function sine(from: number, to: number, y0: number, wave: number, lift: number, phase: number, back: boolean): string {
  const points: Point[] = []
  const step = wave / 10
  for (let x = from; x <= to + step; x += step) {
    points.push([Math.round(x), +(y0 + lift * Math.sin((2 * Math.PI * x) / wave + phase)).toFixed(1)])
  }
  if (back) points.reverse()
  let d = `${points[0]![0]} ${points[0]![1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]!
    const [nx, ny] = points[i + 1]!
    d += ` Q${x} ${y} ${((x + nx) / 2).toFixed(0)} ${((y + ny) / 2).toFixed(1)}`
  }
  const last = points[points.length - 1]!

  return `${d} L${last[0]} ${last[1]}`
}

/** One ribbon of light: a band that swells and thins, drifting sideways and slowly rising and falling. */
function ribbon(rand: () => number, index: number, count: number, speed: number): string {
  const wave = Math.round(420 + rand() * 560)
  const lift = 16 + rand() * 44
  const base = 90 + (index + rand() * 0.9) * (820 / count)
  const thick = 60 + rand() * 120
  const phase = rand() * Math.PI * 2
  const twist = 0.7 + rand() * 1.5
  const top = sine(-wave, 1600 + wave, base, wave, lift, phase, false)
  const bottom = sine(-wave, 1600 + wave, base + thick, wave, lift, phase + twist, true)
  // Slow: a wavelength takes between about one and three minutes to pass.
  const seconds = (wave / ((4 + rand() * 6) * speed)).toFixed(0)
  const rise = ((14 + rand() * 18) / speed).toFixed(1)
  const toLeft = rand() < 0.5

  return `<g class="rise" style="animation-duration:${rise}s;animation-delay:-${(rand() * 20).toFixed(1)}s;--lift:${(lift * 0.7).toFixed(0)}px"><g class="${toLeft ? 'flow left' : 'flow right'}" style="animation-duration:${seconds}s;animation-delay:-${(rand() * 60).toFixed(0)}s;--wave:${wave}px"><path class="band" d="M${top} L${bottom} Z"/><path class="crest" d="M${top}"/></g></g>`
}

/** Where the shadow falls: down and to the right, whatever the heading. */
const SHADOW: Point = [18, 28]

/** The whole scene for one seed: the route, the beat, the ribbons and the drifting specks are drawn from it. */
export function buildScene(seed: number, look: SceneLook): string {
  const rand = rng(seed)
  const path = route(rand)
  // Unhurried: 15 to 19 units a second, so a lap of the window takes a few minutes.
  const seconds = Math.round(length(path) / ((15 + rand() * 4) * look.speed))
  const head = Math.round(rand() * seconds)
  // Where the shark rests when motion is reduced: at the route point nearest the middle of the window, so it is
  // in view. The distance along the route is measured along the straight lines between points, which is close.
  let nearest = 0
  let along = 0
  let restAt = 0
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i]!
    if (i > 0) along += Math.hypot(x - path[i - 1]![0], y - path[i - 1]![1])
    const [nx, ny] = path[nearest]!
    if (Math.hypot(x - 800, y - 500) < Math.hypot(nx - 800, ny - 500)) {
      nearest = i
      restAt = along
    }
  }
  const rest = Math.round((restAt / length(path)) * 100)
  const size = +((0.92 + rand() * 0.14) * look.size).toFixed(2)
  // One sweep of the tail, there and back, takes about three and a half seconds.
  // A faster shark beats faster, but less than in step, so a quick one does not thrash.
  const beat = +((3.2 + rand() * 0.8) / Math.sqrt(look.speed)).toFixed(2)
  // The fins bank on the lap's own clock, so they lean where the route turns.
  const lap = `animation-duration:${seconds}s;animation-delay:-${head}s`
  const outline = `<g transform="scale(${size})">${shark(beat, lap)}</g>`
  const bends = turns(path, 40)
  const banked = (side: number): string =>
    [...bends, bends[0]!].map((bend, at) => `${(at * 2.5).toFixed(1)}%{transform:scaleY(${(1 - side * bend * 0.3).toFixed(2)})}`).join('')
  const mover = (cls: string, dx: number, dy: number) =>
    `<g class="mover ${cls}" style="offset-path:path('${loop(path, dx, dy)}');animation-duration:${seconds}s;animation-delay:-${head}s;--rest:${rest}%">${outline}</g>`
  const count = look.waves
  const ribbons = Array.from({ length: count }, (_, i) => ribbon(rand, i, count, look.waveSpeed)).join('\n')
  const dots = Array.from({ length: look.glints }, () => {
    const r = (1 + rand() * 1.6).toFixed(1)

    return `<circle class="speck" cx="${Math.round(rand() * 1600)}" cy="${Math.round(rand() * 1000)}" r="${r}" style="animation-delay:-${(rand() * 11).toFixed(1)}s"/>`
  })
  // The glints drift a little with the water, half one way and half the other, so they are not pinned in place.
  const specks = `<g class="drift">${dots.filter((_, at) => at % 2 === 0).join('')}</g><g class="drift back">${dots.filter((_, at) => at % 2 === 1).join('')}</g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
svg {
  ${palette(look.dark)}
}
@media (prefers-color-scheme: light) {
  svg {
  ${palette(look.light)}
  }
}
.sea { fill: url(#sea); }
.glow { fill: url(#glow); }

.mover { offset-rotate: auto; offset-distance: var(--rest); animation: swim linear infinite; }
.hinge { transform-box: view-box; animation: beat ease-in-out infinite alternate; }
.bank { transform-box: view-box; animation: linear infinite; }
.bank.left { animation-name: bank-left; }
.bank.right { animation-name: bank-right; }
.silhouette { fill: var(--shark); opacity: var(--shark-o); }
.shadow { fill: var(--shadow); opacity: var(--shadow-o); }

.band { fill: url(#ribbon); }
.crest { fill: none; stroke: url(#crest); stroke-width: 1.6; stroke-linecap: round; }
.flow { animation: linear infinite; }
.flow.left { animation-name: flow-left; }
.flow.right { animation-name: flow-right; transform: translateX(calc(var(--wave) * -1)); }
.rise { animation: rise ease-in-out infinite alternate; }

.speck { fill: var(--speck); opacity: 0; animation: twinkle 11s ease-in-out infinite; }
.drift { animation: drift 46s ease-in-out infinite alternate; }
.drift.back { animation-direction: alternate-reverse; animation-duration: 58s; }

@keyframes swim { from { offset-distance: 0%; } to { offset-distance: 100%; } }
@keyframes bank-left {${banked(1)}}
@keyframes bank-right {${banked(-1)}}
@keyframes beat { from { transform: rotate(calc(var(--swing) * -1)); } to { transform: rotate(var(--swing)); } }
@keyframes flow-left { from { transform: translateX(0); } to { transform: translateX(calc(var(--wave) * -1)); } }
@keyframes flow-right { from { transform: translateX(calc(var(--wave) * -1)); } to { transform: translateX(0); } }
@keyframes rise { from { transform: translateY(calc(var(--lift) * -1)); } to { transform: translateY(var(--lift)); } }
@keyframes drift { from { transform: translate(-22px, -8px); } to { transform: translate(22px, 8px); } }
@keyframes twinkle { 0%, 100% { opacity: 0; } 50% { opacity: var(--speck-o); } }

${look.isMoving ? '' : '* { animation: none !important; }\n.speck { opacity: calc(var(--speck-o) * .5); }'}
.rest { display: none; }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
  .speck { opacity: calc(var(--speck-o) * .5); }
  .rest { display: inline; }
}
</style>
<defs>
  <radialGradient id="sea" cx="46%" cy="44%" r="78%">
    <stop offset="0" style="stop-color: var(--shallow)"/>
    <stop offset=".55" style="stop-color: var(--mid)"/>
    <stop offset="1" style="stop-color: var(--deep)"/>
  </radialGradient>
  <radialGradient id="glow" cx="24%" cy="20%" r="48%">
    <stop offset="0" style="stop-color: var(--glow); stop-opacity: .4"/>
    <stop offset="1" style="stop-color: var(--glow); stop-opacity: 0"/>
  </radialGradient>
  <linearGradient id="crest" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="380" y2="0" spreadMethod="reflect">
    <stop offset="0" style="stop-color: var(--light); stop-opacity: var(--crest-o)"/>
    <stop offset=".55" style="stop-color: var(--light); stop-opacity: calc(var(--crest-o) * .55)"/>
    <stop offset="1" style="stop-color: var(--light); stop-opacity: calc(var(--crest-o) * .12)"/>
  </linearGradient>
  <linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color: var(--light); stop-opacity: var(--band-o)"/>
    <stop offset=".6" style="stop-color: var(--light); stop-opacity: calc(var(--band-o) * .25)"/>
    <stop offset="1" style="stop-color: var(--light); stop-opacity: 0"/>
  </linearGradient>
</defs>
<rect class="sea" x="-100" y="-100" width="1800" height="1200"/>
<rect class="glow" x="-100" y="-100" width="1800" height="1200"/>
${look.isSharkShown ? `<g class="${look.isUnderShader ? 'rest' : 'shark'}">${mover('shadow', SHADOW[0] * size, SHADOW[1] * size)}\n${mover('silhouette', 0, 0)}</g>` : ''}
${look.isUnderShader ? `<g class="rest">${ribbons}</g>` : ribbons}
${specks}
</svg>`
}
