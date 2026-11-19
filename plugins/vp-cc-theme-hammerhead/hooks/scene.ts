// A calm sea seen from above. One hammerhead, a silhouette with line art, cruises a wide loop while slow ribbons of
// light cross the water over it.
//
// The shark is a chain of overlapping segments, each hinged on the one before: body, middle, rear, the stalk of
// the tail, and the two lobes of its fin. Every hinge swings on the same slow beat, each a little later and a
// little wider than the one before it, so a wave travels down the body and the tail sweeps a clear S. The head sweeps the other way, as a
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
  --shark: ${sea.shark}; --shark-o: ${sea.sharkOpacity}; --line: ${sea.line};
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

// The hammerhead, nose toward +x, about 510 long, cut from one symmetric drawing seen from straight above: an
// ink silhouette with line art inside it. Each part overlaps the next, so a hinge never opens a gap. A part is one
// path or several: a fin is its own path beside the trunk, never a subpath of it. The two fins of a pair are
// mirror images, so they wind opposite ways, and inside one path the trunk would cut a slit into one.
//
// Each part's line art (the `_LINES` beside it) rides the same hinge as the part. It is drawn in a second pass,
// after every silhouette, so a part that overlaps the next never hides the next one's lines.
type Part = readonly string[]

/**
 * The cephalofoil: a broad hammer whose front edge waves between the nose and the two eye lobes, each lobe a
 * rounded block that sweeps back to a short neck.
 */
const HEAD: Part = [
  'M151.4 0 C151.4 11.5 156.8 13.6 156.1 24 C155.4 36.9 148.2 45.5 146.8 58 C145.3 71.2 155 82.3 154.7 88.4 C148.2 96.7 134.6 101.3 124.2 99.5 C113.5 98.5 110.3 90.6 111.7 82 C113.8 69.1 119.2 56.9 116.3 45.1 C114.2 34.7 107 29.4 98.1 30.1 L93.4 30.8 L93.4 -30.8 L98.1 -30.1 C107 -29.4 114.2 -34.7 116.3 -45.1 C119.2 -56.9 113.8 -69.1 111.7 -82 C110.3 -90.6 113.5 -98.5 124.2 -99.5 C134.6 -101.3 148.2 -96.7 154.7 -88.4 C155 -82.3 145.3 -71.2 146.8 -58 C148.2 -45.5 155.4 -36.9 156.1 -24 C156.8 -13.6 151.4 -11.5 151.4 0 Z',
]
/** The front of the body, from the neck past the pectorals, deepest where the pectorals join it. */
const BODY: Part = [
  'M104.2 27.2 L98.1 30.1 C83.4 30.4 71.6 40.5 40.8 39.4 L-23.3 34.4 L-29 33.7 L-29 -33.7 L-23.3 -34.4 L40.8 -39.4 C71.6 -40.5 83.4 -30.4 98.1 -30.1 L104.2 -27.2 Z',
]
// The pectorals are angled down from the body, so when the shark banks into a turn the inner one drops away and
// looks shorter from above while the outer one flattens and looks longer. Each scales across the body about its
// own root, on keyframes baked from the route's turns.
//
// From above they are long swept blades: a broad root, a leading edge that sweeps back to a far point, and a
// hollow trailing edge that runs back into the body.
const PECTORALS = [
  {
    side: 'left',
    root: -37,
    d: 'M40.8 -39.4 C28.3 -45.1 18.3 -65.9 1.8 -84.1 C-18.6 -107.4 -37.6 -123.9 -58.4 -135 C-40.8 -110.6 -29.4 -80.9 -19.7 -52.6 C-16.8 -44 -17.2 -37.2 -23.3 -34.4 Z',
    line: 'M-39 -115.3 L-32.3 -103.1 L-25.8 -90.2 L-20 -77.3 L-15.3 -65.1 L-11.9 -54.2 L-10.4 -45.5 L-12.1 -39.3 L-17.2 -34.4 L-10.1 -38.7 L-8.2 -45.8 L-9.5 -56.3 L-12.9 -68 L-17.9 -80.3 L-24.1 -92.7 L-31.3 -104.5 Z',
  },
  {
    side: 'right',
    root: 37,
    d: 'M40.8 39.4 C28.3 45.1 18.3 65.9 1.8 84.1 C-18.6 107.4 -37.6 123.9 -58.4 135 C-40.8 110.6 -29.4 80.9 -19.7 52.6 C-16.8 44 -17.2 37.2 -23.3 34.4 Z',
    line: 'M-39 115.3 L-32.3 103.1 L-25.8 90.2 L-20 77.3 L-15.3 65.1 L-11.9 54.2 L-10.4 45.5 L-12.1 39.3 L-17.2 34.4 L-10.1 38.7 L-8.2 45.8 L-9.5 56.3 L-12.9 68 L-17.9 80.3 L-24.1 92.7 L-31.3 104.5 Z',
  },
] as const
const MIDDLE: Part = [
  'M-17.5 34.7 L-23.3 34.4 C-46.9 32.2 -71.2 23.3 -85.9 21.8 L-92.7 21.5 L-92.7 -21.5 L-85.9 -21.8 C-71.2 -23.3 -46.9 -32.2 -23.3 -34.4 L-17.5 -34.7 Z',
]
/** The rear of the body, narrowing toward the stalk, with the pelvic fins: small swept blades. */
const REAR: Part = [
  'M-80.5 22.2 L-85.9 21.8 C-98.5 21.1 -109.5 21.5 -117.8 23.3 L-158.2 22.6 L-164.3 21.8 L-164.3 -21.8 L-158.2 -22.6 L-117.8 -23.3 C-109.5 -21.5 -98.5 -21.1 -85.9 -21.8 L-80.5 -22.2 Z',
  'M-117.8 23.3 C-125.7 25.1 -133.2 34.4 -142.5 38.7 C-153.2 43.7 -166.1 46.2 -176.1 44 C-167.2 36.5 -161.1 27.9 -158.2 22.6 Z',
  'M-117.8 -23.3 C-125.7 -25.1 -133.2 -34.4 -142.5 -38.7 C-153.2 -43.7 -166.1 -46.2 -176.1 -44 C-167.2 -36.5 -161.1 -27.9 -158.2 -22.6 Z',
]
/** The stalk of the tail. */
const STALK: Part = [
  'M-152.9 22.9 L-158.2 22.6 C-169.3 16.5 -187.6 13.2 -207.3 10.7 C-231.6 7.2 -252 6.1 -266.4 7.9 L-272.8 7.5 L-272.8 -7.5 L-266.4 -7.9 C-252 -6.1 -231.6 -7.2 -207.3 -10.7 C-187.6 -13.2 -169.3 -16.5 -158.2 -22.6 L-152.9 -22.9 Z',
]
// The caudal fin is an upright blade, so from straight above it is narrow: a long upper lobe that tapers to a point
// on the axis, with a shorter lower lobe under it. As the tail sweeps, the water leans the blade over, and a
// leaning blade shows its upper lobe to one side and its lower lobe to the other. So each lobe is its own hinge on
// the end of the stalk, and they swing opposite ways on the same beat: the fork opens as the tail sweeps and closes
// as the blade stands up again, when the lower lobe lies wholly under the upper one. Each lobe reaches a little way
// into the stalk, so no seam opens where it turns.
const UPPER_LOBE: Part = [
  'M-252 5.8 L-266.4 7.9 C-291.4 6.8 -321.2 3.9 -351.9 0 C-321.2 -3.9 -291.4 -6.8 -266.4 -7.9 L-252 -5.8 Z',
]
const LOWER_LOBE: Part = [
  'M-252 5.2 L-266.4 6.8 C-280.6 5.8 -298.2 3.4 -316.4 0 C-298.2 -3.4 -280.6 -5.8 -266.4 -6.8 L-252 -5.2 Z',
]

const HEAD_LINES: Part = [
  'M140.3 92.7 L127.6 96 L118.3 93.2 L115.3 85.9 L117.2 76 L120.3 65.5 L123 54.8 L123.5 44 L121 33.9 L114.9 26.9 L105.3 22.9 L115.9 26.3 L123 33.3 L125.3 43.3 L124.9 55.3 L122.2 66.5 L118.9 76.6 L116.7 85.6 L119.3 92.7 L128.2 95.1 Z',
  'M140.3 -92.7 L127.6 -96 L118.3 -93.2 L115.3 -85.9 L117.2 -76 L120.3 -65.5 L123 -54.8 L123.5 -44 L121 -33.9 L114.9 -26.9 L105.3 -22.9 L115.9 -26.3 L123 -33.3 L125.3 -43.3 L124.9 -55.3 L122.2 -66.5 L118.9 -76.6 L116.7 -85.6 L119.3 -92.7 L128.2 -95.1 Z',
  'M138.5 0 L105.5 0.4 L98 0.5 L98 -0.5 L105.5 -0.4 Z',
]
const BODY_LINES: Part = [
  'M32.6 32.9 L20.5 36 L8.8 36.7 L-2.9 35.5 L-14.4 33 L-22 30.7 L-22 28.6 L-17.5 29.9 L-5 33 L7.6 34.9 L20.1 35 Z',
  'M85.2 14.3 L82.7 25.6 L74.5 34 L81.2 25.2 Z',
  'M77.3 15 L74.8 26.4 L66.6 34.7 L73.3 26 Z',
  'M69.5 15.4 L66.9 26.7 L58.7 35.1 L65.4 26.3 Z',
  'M32.6 -32.9 L20.5 -36 L8.8 -36.7 L-2.9 -35.5 L-14.4 -33 L-22 -30.7 L-22 -28.6 L-17.5 -29.9 L-5 -33 L7.6 -34.9 L20.1 -35 Z',
  'M85.2 -14.3 L82.7 -25.6 L74.5 -34 L81.2 -25.2 Z',
  'M77.3 -15 L74.8 -26.4 L66.6 -34.7 L73.3 -26 Z',
  'M69.5 -15.4 L66.9 -26.7 L58.7 -35.1 L65.4 -26.3 Z',
  'M98 0.5 L68.1 0.7 L27 0.9 L-17 1 L-22 1 L-22 -1 L-17 -1 L27 -0.9 L68.1 -0.7 L98 -0.5 Z',
]
const MIDDLE_LINES: Part = [
  'M-22 30.7 L-25.8 29.5 L-37.2 25.8 L-49.8 22.2 L-62.7 19.5 L-75.8 17.3 L-86 16.1 L-86 14.6 L-75.6 15.6 L-63.9 17.4 L-52.7 19.7 L-42.2 22.6 L-30 26.3 L-22 28.6 Z',
  'M-22 -30.7 L-25.8 -29.5 L-37.2 -25.8 L-49.8 -22.2 L-62.7 -19.5 L-75.8 -17.3 L-86 -16.1 L-86 -14.6 L-75.6 -15.6 L-63.9 -17.4 L-52.7 -19.7 L-42.2 -22.6 L-30 -26.3 L-22 -28.6 Z',
  'M-22 1 L-63.1 1.1 L-86 1.1 L-86 -1.1 L-63.1 -1.1 L-22 -1 Z',
]
const REAR_LINES: Part = [
  'M-86 16.1 L-88.9 15.8 L-101.8 14.7 L-114.6 14 L-100.9 13.8 L-87.9 14.4 L-86 14.6 Z',
  'M-123.9 21.5 L-132.6 26.4 L-144 33.9 L-158.2 39.7 L-147.2 33.6 L-137.5 26.3 L-131 21.1 L-167.5 15 L-155.8 16.3 L-144.2 17.9 L-133.4 19.6 Z',
  'M-86 -16.1 L-88.9 -15.8 L-101.8 -14.7 L-114.6 -14 L-100.9 -13.8 L-87.9 -14.4 L-86 -14.6 Z',
  'M-123.9 -21.5 L-132.6 -26.4 L-144 -33.9 L-158.2 -39.7 L-147.2 -33.6 L-137.5 -26.3 L-131 -21.1 L-167.5 -15 L-155.8 -16.3 L-144.2 -17.9 L-133.4 -19.6 Z',
  'M-86 1.1 L-110.6 1 L-158 0.9 L-158 -0.9 L-110.6 -1 L-86 -1.1 Z',
]
const STALK_LINES: Part = [
  'M-158 0.9 L-158.8 0.9 L-206.8 0.7 L-254 0.4 L-266 0.3 L-266 -0.3 L-254 -0.4 L-206.8 -0.7 L-158.8 -0.9 L-158 -0.9 Z',
]
// The spine runs on into the upper lobe. The lower lobe has no line of its own: at rest it lies under the upper
// one, and a line drawn over every silhouette would show through.
const UPPER_LOBE_LINES: Part = [
  'M-266 0.3 L-299.6 0 L-266 -0.3 Z',
]
const LOWER_LOBE_LINES: Part = []

/** The hinges, from the body back: the part and its lines, where each turns, how far, and how late in the beat. */
const HINGES = [
  { part: MIDDLE, lines: MIDDLE_LINES, x: -22, swing: 4.5, lag: 0.14 },
  { part: REAR, lines: REAR_LINES, x: -86, swing: 6.5, lag: 0.28 },
  { part: STALK, lines: STALK_LINES, x: -158, swing: 9, lag: 0.42 },
] as const

/** The two lobes of the caudal fin, each hinged where the stalk ends, swinging opposite ways. */
const LOBES = [
  { part: LOWER_LOBE, lines: LOWER_LOBE_LINES, x: -266, swing: -7, lag: 0.68 },
  { part: UPPER_LOBE, lines: UPPER_LOBE_LINES, x: -266, swing: 9, lag: 0.68 },
] as const

/** Where the pectorals bank from, between their roots, and where the head turns, on the body's axis. */
const BANK_AT = 9
const HEAD_TURN = 80

function paths(part: Part, cls = ''): string {
  return part.map(d => `<path${cls ? ` class="${cls}"` : ''} d="${d}"/>`).join('')
}

/** One hinge: a group that swings about a point on the body's axis, a share of a beat behind the head. */
function hinge(x: number, swing: number, lag: number, beat: number, inside: string): string {
  return `<g class="hinge" style="transform-origin:${x}px 0;--swing:${swing}deg;animation-duration:${beat / 2}s;animation-delay:${(-beat * (1 - lag)).toFixed(2)}s">${inside}</g>`
}

/**
 * The shark, every hinge beating; `beat` is one full sweep, there and back, in seconds. With `isLines` it is the
 * line art alone, on the same hinges and the same beat, so it lies over the silhouette and moves with it.
 */
function shark(beat: number, lap: string, isLines: boolean): string {
  const of = (part: Part, lines: Part): string => (isLines ? paths(lines, 'line') : paths(part))
  let chain = LOBES.map(lobe => hinge(lobe.x, lobe.swing, lobe.lag, beat, of(lobe.part, lobe.lines))).join('')
  for (const part of [...HINGES].reverse()) {
    chain = hinge(part.x, part.swing, part.lag, beat, of(part.part, part.lines) + chain)
  }

  // The whole body yaws a little against the tail, and the head sweeps against the body.
  const fins = PECTORALS.map(fin => `<g class="bank ${fin.side}" style="transform-origin:${BANK_AT}px ${fin.root}px;${lap}">${isLines ? `<path class="line" d="${fin.line}"/>` : `<path d="${fin.d}"/>`}</g>`).join('')

  return hinge(20, -2, 0.08, beat, `${chain}${fins}${of(BODY, BODY_LINES)}${hinge(HEAD_TURN, -3.5, 0.16, beat, of(HEAD, HEAD_LINES))}`)
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
  // The shadow is the silhouette alone; the shark itself carries its line art over it.
  const outline = (isLines: boolean): string =>
    `<g transform="scale(${size})">${shark(beat, lap, false)}${isLines ? shark(beat, lap, true) : ''}</g>`
  const bends = turns(path, 40)
  const banked = (side: number): string =>
    [...bends, bends[0]!].map((bend, at) => `${(at * 2.5).toFixed(1)}%{transform:scaleY(${(1 - side * bend * 0.3).toFixed(2)})}`).join('')
  const mover = (cls: string, dx: number, dy: number, isLines: boolean) =>
    `<g class="mover ${cls}" style="offset-path:path('${loop(path, dx, dy)}');animation-duration:${seconds}s;animation-delay:-${head}s;--rest:${rest}%">${outline(isLines)}</g>`
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
.silhouette .line { fill: var(--line); }
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
${look.isSharkShown ? `<g class="${look.isUnderShader ? 'rest' : 'shark'}">${mover('shadow', SHADOW[0] * size, SHADOW[1] * size, false)}\n${mover('silhouette', 0, 0, true)}</g>` : ''}
${look.isUnderShader ? `<g class="rest">${ribbons}</g>` : ribbons}
${specks}
</svg>`
}
