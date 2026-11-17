// A calm sea seen from above. One hammerhead, a pure silhouette, cruises a wide loop while slow ribbons of
// light cross the water over it.
//
// The shark is a chain of overlapping segments, each hinged on the one before: body, middle, rear, and a tail in
// two parts. Every hinge swings on the same slow beat, each a little later and a little wider than the one before
// it, so a wave travels down the body and the tail sweeps a clear S. The head sweeps the other way, as a
// hammerhead's does. The route is a CSS motion path with `offset-rotate: auto`, so the shark faces where it goes.
//
// The water is drawn as ribbons: bands between two sine curves, each with its own wavelength, height, speed and
// direction, each also rising and falling on its own period, so their overlaps keep changing.
//
// No script, no filter, no blend mode: an animated SVG image repaints every frame, and those cost the most.
// The surface tells a scene nothing about light or dark, so the SVG switches its own palette with a media query:
// a warm Gruvbox night sea in dark mode, an Everforest lagoon in light mode. All motion stops when the system
// asks for reduced motion.

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

/** A path drawn on the left side, and the same path mirrored onto the right. */
function both(draw: (side: number) => string): string {
  return `${draw(-1)} ${draw(1)}`
}

// The hammerhead, nose toward +x, about 445 long. Each part overlaps the next, so a hinge never opens a gap.
/** The cephalofoil: a thin blade across the front, wider than the fins behind it, its tips swept back, on a slim neck. */
const HEAD =
  'M150 0 C152 -10 152 -40 146 -62 C142 -76 134 -87 126 -87 C121 -87 120 -81 122 -74 C127 -56 126 -36 117 -23 C109 -14 99 -11 88 -10 L88 10 C99 11 109 14 117 23 C126 36 127 56 122 74 C120 81 121 87 126 87 C134 87 142 76 146 62 C152 40 152 10 150 0 Z'
/** Neck to the widest part of the body, with the swept pectorals. */
const BODY =
  'M98 -10 C72 -17 48 -25 24 -27.5 C8 -29 -10 -28 -26 -26 L-26 26 C-10 28 8 29 24 27.5 C48 25 72 17 98 10 Z ' +
  both(k => `M40 ${k * 23} C28 ${k * 31} 8 ${k * 46} -26 ${k * 64} C-33 ${k * 68} -40 ${k * 66} -38 ${k * 60} C-30 ${k * 46} -18 ${k * 34} -6 ${k * 25} Z`)
const MIDDLE = 'M-6 -27.5 C-34 -26 -62 -21 -88 -15.5 L-88 15.5 C-62 21 -34 26 -6 27.5 Z'
/** The rear of the body, narrowing to the stalk, with the small pelvic fins. */
const REAR =
  'M-70 -19 C-100 -13.5 -128 -8 -154 -4.5 L-154 4.5 C-128 8 -100 13.5 -70 19 Z ' +
  both(k => `M-92 ${k * 13} C-102 ${k * 21} -114 ${k * 29} -127 ${k * 32} C-125 ${k * 24} -117 ${k * 16} -106 ${k * 10} Z`)
/** The tail from above: a slim stalk, then the caudal fin as a narrow leaf; in two parts, so its tip whips. */
const TAIL_A = 'M-142 -5.5 C-172 -5 -202 -4 -232 -2.6 L-232 2.6 C-202 4 -172 5 -142 5.5 Z'
const TAIL_B = 'M-222 -3.2 C-236 -4.4 -252 -6.4 -266 -6.2 C-282 -5.6 -296 -2.6 -306 0 C-296 2.6 -282 5.6 -266 6.2 C-252 6.4 -236 4.4 -222 3.2 Z'

/** The hinges, from the body back: where each turns, how far, and how late in the beat. */
const HINGES = [
  { part: MIDDLE, x: -16, swing: 4.5, lag: 0.14 },
  { part: REAR, x: -80, swing: 6.5, lag: 0.28 },
  { part: TAIL_A, x: -148, swing: 9, lag: 0.42 },
  { part: TAIL_B, x: -226, swing: 12, lag: 0.56 },
] as const

/** The shark's outline, every hinge beating; `beat` is one full sweep, there and back, in seconds. */
function shark(beat: number): string {
  const half = beat / 2
  let chain = ''
  for (const hinge of [...HINGES].reverse()) {
    chain = `<g class="hinge" style="transform-origin:${hinge.x}px 0;--swing:${hinge.swing}deg;animation-duration:${half}s;animation-delay:${(-beat * (1 - hinge.lag)).toFixed(2)}s"><path d="${hinge.part}"/>${chain}</g>`
  }

  // The whole body yaws a little against the tail, and the head sweeps against the body.
  return `<g class="hinge" style="transform-origin:20px 0;--swing:-2deg;animation-duration:${half}s;animation-delay:${(-beat * 0.92).toFixed(2)}s">
  ${chain}<path d="${BODY}"/>
  <g class="hinge" style="transform-origin:66px 0;--swing:-3.5deg;animation-duration:${half}s;animation-delay:${(-beat * 0.84).toFixed(2)}s"><path d="${HEAD}"/></g>
</g>`
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
export function buildScene(seed: number): string {
  const rand = rng(seed)
  const path = route(rand)
  // Unhurried: 15 to 19 units a second, so a lap of the window takes a few minutes.
  const seconds = Math.round(length(path) / (15 + rand() * 4))
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
  const size = +(0.92 + rand() * 0.14).toFixed(2)
  // One sweep of the tail, there and back, takes about three and a half seconds.
  const beat = +(3.2 + rand() * 0.8).toFixed(2)
  const outline = `<g transform="scale(${size})">${shark(beat)}</g>`
  const mover = (cls: string, dx: number, dy: number) =>
    `<g class="mover ${cls}" style="offset-path:path('${loop(path, dx, dy)}');animation-duration:${seconds}s;animation-delay:-${head}s;--rest:${rest}%">${outline}</g>`
  const count = 5
  const ribbons = Array.from({ length: count }, (_, i) => ribbon(rand, i, count)).join('\n')
  const specks = Array.from({ length: 22 }, () => {
    const r = (1 + rand() * 1.6).toFixed(1)

    return `<circle class="speck" cx="${Math.round(rand() * 1600)}" cy="${Math.round(rand() * 1000)}" r="${r}" style="animation-delay:-${(rand() * 11).toFixed(1)}s"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
svg {
  --deep: #1d2021; --mid: #282828; --shallow: #32302f; --glow: #504945;
  --light: #ebdbb2; --band-o: .1; --crest-o: .22;
  --shark: #d5c4a1; --shark-o: .42;
  --shadow: #000; --shadow-o: .2;
  --speck: #fabd2f; --speck-o: .5;
}
@media (prefers-color-scheme: light) {
  svg {
    --deep: #9fc4b3; --mid: #bdd6c2; --shallow: #dbe5cd; --glow: #f4f0d9;
    --light: #fff; --band-o: .62; --crest-o: .95;
    --shark: #5c6a72; --shark-o: .62;
    --shadow: #5c7a70; --shadow-o: .13;
    --speck: #fff; --speck-o: .9;
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
${mover('shadow', SHADOW[0] * size, SHADOW[1] * size)}
${mover('silhouette', 0, 0)}
${ribbons}
${specks}
</svg>`
}
