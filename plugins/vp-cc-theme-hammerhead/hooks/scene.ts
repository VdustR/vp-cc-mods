// A calm sea seen from above. One hammerhead, a pure silhouette, cruises a wide loop while slow ribbons of
// light cross the water over it.
//
// The shark is a chain of overlapping segments, each hinged on the one before: body, middle, rear, the stalk of
// the tail, and the two lobes of its fin. Every hinge swings on the same slow beat, each a little later and a little wider than the one before
// it, so a wave travels down the body and the tail sweeps a clear S. The head sweeps the other way, as a
// hammerhead's does. The route is a CSS motion path with `offset-rotate: auto`, so the shark faces where it goes.
//
// The water is drawn as ribbons: bands between two sine curves, each with its own wavelength, height, speed and
// direction, each also rising and falling on its own period, so their overlaps keep changing.
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
  hasGlints: boolean
  /** False rests everything in place, as reduced motion does. */
  isMoving: boolean
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
 * A random closed route around the middle of the window. Its points go round in angle order, so the loop never
 * crosses itself; it reaches the window's edges and a little past them, so the shark leaves and comes back.
 */
function route(rand: () => number): Point[] {
  const count = 7 + Math.floor(rand() * 3)
  const start = rand() * Math.PI * 2
  const points: Point[] = []
  for (let i = 0; i < count; i++) {
    const a = start + ((i + (rand() - 0.5) * 0.5) / count) * Math.PI * 2
    const r = 300 + rand() * 260
    points.push([Math.round(800 + Math.cos(a) * r * 1.3), Math.round(500 + Math.sin(a) * r * 0.78)])
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
 * The cephalofoil, as a great hammerhead's reads from above: a short, broad hammer on a thick neck. Its front edge
 * bows gently forward, and each end is a flat block that stands a little proud of the wing, both forward and back.
 */
const HEAD: Part = [
  'M152.5 0 C152.5 -8 151.8 -18 150.3 -27 C149.4 -33 148.6 -38 148.8 -43 C149.2 -47 150.5 -50 153 -53 C156 -56 157.5 -63 154 -66.5 C151.5 -69.5 146 -70.5 138 -70.5 C130 -70.5 122 -70.5 116 -70 C111 -69.5 107.5 -65 109 -60 C110 -54 121 -50 123 -44 C124 -37 113 -31 104 -27.5 C98 -24.5 93 -22.5 86 -21.5 L86 21.5 C93 22.5 98 24.5 104 27.5 C113 31 124 37 123 44 C121 50 110 54 109 60 C107.5 65 111 69.5 116 70 C122 70.5 130 70.5 138 70.5 C146 70.5 151.5 69.5 154 66.5 C157.5 63 156 56 153 53 C150.5 50 149.2 47 148.8 43 C148.6 38 149.4 33 150.3 27 C151.8 18 152.5 8 152.5 0 Z',
]
/** Neck to the widest part of the body, with the pectorals: broad at the base, long, pointed and swept back. */
const BODY: Part = [
  'M94 -21 C72 -25 48 -28.5 24 -29.5 C8 -30.5 -10 -29.5 -26 -27 L-26 27 C-10 29.5 8 30.5 24 29.5 C48 28.5 72 25 94 21 Z',
  'M60 -25 C46 -37 18 -58 -30 -80 C-28 -64 -14 -43 12 -27 Z',
  'M60 25 C46 37 18 58 -30 80 C-28 64 -14 43 12 27 Z',
]
const MIDDLE: Part = ['M-6 -28.5 C-34 -27 -62 -22 -88 -16 L-88 16 C-62 22 -34 27 -6 28.5 Z']
/** The rear of the body, narrowing to the stalk, with the small pelvic fins. */
const REAR: Part = [
  'M-70 -19.5 C-100 -14 -128 -8.5 -154 -5 L-154 5 C-128 8.5 -100 14 -70 19.5 Z',
  'M-88 -14 C-100 -23 -114 -32 -132 -36 C-129 -26 -119 -16 -104 -10 Z',
  'M-88 14 C-100 23 -114 32 -132 36 C-129 26 -119 16 -104 10 Z',
]
/** The stalk of the tail. */
const STALK: Part = ['M-142 -6 C-172 -5.4 -202 -4.2 -232 -2.8 L-232 2.8 C-202 4.2 -172 5.4 -142 6 Z']
// The caudal fin is a tall blade with a long upper lobe and a short lower one. From straight above the two lie on
// one line. As the tail sweeps, the water leans the blade over, and a leaning blade shows its upper lobe to one
// side and its lower lobe to the other. So each lobe is its own hinge on the end of the stalk, and they swing
// opposite ways on the same beat: the fork opens as the tail sweeps and closes as the blade stands up again.
const UPPER_LOBE: Part = ['M-220 -3.2 C-244 -5.2 -276 -7.6 -300 -6.4 C-316 -5 -330 -2 -340 0 C-330 2 -316 4.4 -300 5 C-276 5.4 -244 4.4 -220 3.2 Z']
const LOWER_LOBE: Part = ['M-220 -3 C-234 -4.6 -250 -6 -262 -5.2 C-272 -4 -280 -1.6 -286 0 C-280 1.6 -272 3.6 -262 4.4 C-250 4.8 -234 4 -220 3 Z']

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
function shark(beat: number): string {
  let chain = LOBES.map(lobe => hinge(lobe.x, lobe.swing, lobe.lag, beat, paths(lobe.part))).join('')
  for (const part of [...HINGES].reverse()) {
    chain = hinge(part.x, part.swing, part.lag, beat, paths(part.part) + chain)
  }

  // The whole body yaws a little against the tail, and the head sweeps against the body.
  return hinge(20, -2, 0.08, beat, `${chain}${paths(BODY)}${hinge(66, -3.5, 0.16, beat, paths(HEAD))}`)
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
function ribbon(rand: () => number, index: number, count: number): string {
  const wave = Math.round(420 + rand() * 560)
  const lift = 16 + rand() * 44
  const base = 90 + (index + rand() * 0.9) * (820 / count)
  const thick = 60 + rand() * 120
  const phase = rand() * Math.PI * 2
  const twist = 0.7 + rand() * 1.5
  const top = sine(-wave, 1600 + wave, base, wave, lift, phase, false)
  const bottom = sine(-wave, 1600 + wave, base + thick, wave, lift, phase + twist, true)
  // Slow: a wavelength takes between about one and three minutes to pass.
  const seconds = (wave / (4 + rand() * 6)).toFixed(0)
  const rise = (14 + rand() * 18).toFixed(1)
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
  const outline = `<g transform="scale(${size})">${shark(beat)}</g>`
  const mover = (cls: string, dx: number, dy: number) =>
    `<g class="mover ${cls}" style="offset-path:path('${loop(path, dx, dy)}');animation-duration:${seconds}s;animation-delay:-${head}s;--rest:${rest}%">${outline}</g>`
  const count = look.waves
  const ribbons = Array.from({ length: count }, (_, i) => ribbon(rand, i, count)).join('\n')
  const specks = Array.from({ length: 22 }, () => {
    const r = (1 + rand() * 1.6).toFixed(1)

    return `<circle class="speck" cx="${Math.round(rand() * 1600)}" cy="${Math.round(rand() * 1000)}" r="${r}" style="animation-delay:-${(rand() * 11).toFixed(1)}s"/>`
  }).join('')

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
.silhouette { fill: var(--shark); opacity: var(--shark-o); }
.shadow { fill: var(--shadow); opacity: var(--shadow-o); }

.band { fill: url(#ribbon); }
.crest { fill: none; stroke: var(--light); stroke-width: 1.8; stroke-opacity: var(--crest-o); }
.flow { animation: linear infinite; }
.flow.left { animation-name: flow-left; }
.flow.right { animation-name: flow-right; transform: translateX(calc(var(--wave) * -1)); }
.rise { animation: rise ease-in-out infinite alternate; }

.speck { fill: var(--speck); opacity: 0; animation: twinkle 11s ease-in-out infinite; }

@keyframes swim { from { offset-distance: 0%; } to { offset-distance: 100%; } }
@keyframes beat { from { transform: rotate(calc(var(--swing) * -1)); } to { transform: rotate(var(--swing)); } }
@keyframes flow-left { from { transform: translateX(0); } to { transform: translateX(calc(var(--wave) * -1)); } }
@keyframes flow-right { from { transform: translateX(calc(var(--wave) * -1)); } to { transform: translateX(0); } }
@keyframes rise { from { transform: translateY(calc(var(--lift) * -1)); } to { transform: translateY(var(--lift)); } }
@keyframes twinkle { 0%, 100% { opacity: 0; } 50% { opacity: var(--speck-o); } }

${look.isMoving ? '' : '* { animation: none !important; }\n.speck { opacity: calc(var(--speck-o) * .5); }'}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
  .speck { opacity: calc(var(--speck-o) * .5); }
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
  <linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color: var(--light); stop-opacity: var(--band-o)"/>
    <stop offset=".6" style="stop-color: var(--light); stop-opacity: calc(var(--band-o) * .25)"/>
    <stop offset="1" style="stop-color: var(--light); stop-opacity: 0"/>
  </linearGradient>
</defs>
<rect class="sea" x="-100" y="-100" width="1800" height="1200"/>
<rect class="glow" x="-100" y="-100" width="1800" height="1200"/>
${look.isSharkShown ? `${mover('shadow', SHADOW[0] * size, SHADOW[1] * size)}\n${mover('silhouette', 0, 0)}` : ''}
${ribbons}
${look.hasGlints ? specks : ''}
</svg>`
}
