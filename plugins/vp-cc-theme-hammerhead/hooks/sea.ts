// The moving sea, played on the GPU by the desktop app. The engine reads this file and never runs it: it is a
// shader written in TypeScript against 'claude-code/shader', and it may import nothing else.
//
// The still sea under it (scene.ts, drawn without motion) gives every color: the shader reads that picture,
// bends it with a slow, layered flow so its ribbons of light drift and wind, lays more light over it, and draws the
// shark from triangles cut out of the same paths the SVG uses (scripts/mesh.mjs writes them below). The surface
// tells a shader nothing about light or dark, so the shark and its shadow are shades of the water they swim over,
// worked out pixel by pixel: paler on dark water, darker on light water, as look.ts makes them for the SVG.
//
// Everything that moves is stepped with `dt` in a small buffer, so a change of pace eases in place and the shark
// never jumps. The shark swims free, wandering, and turns toward the pointer while it moves.

import {
  PI, abs, atan, buffer, clamp, cos, dot, dt, exp, first, floor, fract, length, max, min, mix, mod, picture, pointer, pointerCount, range, scene, shader, signed,
  shapes, sin, size, smoothstep, sqrt, step, table, values, vec2, vec3, vec4,
} from 'claude-code/shader'
import type { Buffer, vec2 as Vec2, vec3 as Vec3 } from 'claude-code/shader'

const v = values({
  /** Which route, beat and start: a whole number. */
  seed: [0, 1023],
  /** The shark's size and pace, where 1 is its own. */
  size: [0.5, 2],
  speed: [0.5, 2],
  /** How fast the water flows, where 1 is its own pace. */
  flow: [0.5, 2],
  /** How far the shark stands out from the water, 1 (faint) to 10 (bold), as look.ts reads it. */
  tone: [1, 10],
  /** How deep the sea is, 1 to 10: how far its light stands out and how dark the shadow falls. */
  depth: [1, 10],
  /** Two choices in one whole number: 1 shows the shark, and twice 0, 1 or 2 draws 3, 5 or 7 ribbons. */
  kinds: [0, 7],
  /** 1 while Claude works: the shark swims faster and the water flows faster, easing in and out. */
  rush: [0, 1],
})

// mesh:start (written by scripts/mesh.mjs)
const VERTICES = 681
const POINTS_A = table([[-18, 30], [-18, -30], [-26, -28], [-26, 29], [0, 31], [0, -31], [-3, -31], [-15, -30], [-15, 30], [-3, 31], [18, 33], [18, -33], [10, -32], [10, 32], [36, 34], [36, -33], [23, -33], [23, 33], [54, 33], [54, -33], [49, -34], [49, 34], [72, 32], [72, -32], [61, -33], [61, 33], [90, 30], [90, -30], [84, -31], [73, -32], [73, 32], [84, 31], [94, 29], [94, -29], [152, 13], [153, 0], [152, -13], [150, -27], [149, -35], [153, -53], [156, -60], [154, -66], [149, -43], [148, -70], [138, -70], [126, -70], [116, -70], [110, -67], [109, -60], [116, -52], [123, -44], [119, -35], [108, -30], [97, -29], [86, -29], [86, 29], [97, 29], [108, 30], [119, 35], [123, 44], [116, 52], [109, 60], [110, 67], [116, 70], [126, 70], [138, 71], [148, 70], [154, 67], [156, 60], [153, 53], [149, 43], [149, 35], [150, 27], [-72, 20], [-72, -20], [-75, -19], [-88, -16], [-88, 16], [-75, 19], [-54, 24], [-54, -24], [-61, -22], [-61, 22], [-36, 27], [-36, -27], [-48, -25], [-48, 25], [-18, 29], [-18, -29], [-20, -29], [-34, -27], [-34, 27], [-20, 29], [-6, 31], [-6, -30], [-144, 6], [-144, -6], [-154, -5], [-154, 5], [-126, 9], [-126, -9], [-131, -8], [-143, -7], [-143, 7], [-131, 8], [-108, 12], [-108, -12], [-119, -10], [-119, 10], [-90, 16], [-90, -16], [-95, -15], [-107, -13], [-107, 13], [-95, 15], [-72, 19], [-72, -19], [-83, -17], [-83, 17], [-70, 20], [-70, -19], [-108, -11], [-108, -31], [-114, -34], [-126, -40], [-123, -30], [-119, -20], [-112, -10], [-90, -15], [-90, -20], [-93, -22], [-103, -28], [-84, -16], [-108, 11], [-108, 31], [-114, 34], [-126, 40], [-123, 30], [-119, 20], [-112, 10], [-90, 15], [-90, 20], [-93, 22], [-103, 28], [-84, 16], [-216, 4], [-216, -4], [-219, -3], [-232, -3], [-232, 3], [-219, 3], [-198, 4], [-198, -4], [-206, -4], [-206, 4], [-180, 5], [-180, -5], [-181, -5], [-193, -4], [-193, 4], [-181, 5], [-162, 6], [-162, -6], [-168, -5], [-168, 5], [-144, 6], [-144, -6], [-155, -6], [-155, 6], [-142, 6], [-142, -6], [-342, -3], [-352, -2], [-342, -1], [-324, 1], [-324, -5], [-331, -4], [-333, 0], [-306, 3], [-306, -6], [-312, -6], [-314, 2], [-288, 4], [-288, -7], [-294, -7], [-295, 3], [-270, 4], [-270, -7], [-276, -7], [-278, 4], [-252, 4], [-252, -6], [-260, -6], [-261, 4], [-234, 4], [-234, -5], [-245, -6], [-246, 4], [-220, 3], [-220, -3], [-232, -4], [-232, 4], [-288, 0], [-290, 0], [-270, 3], [-270, -3], [-276, -3], [-276, 2], [-252, 4], [-252, -5], [-263, -4], [-263, 3], [-234, 4], [-234, -4], [-239, -5], [-250, -5], [-250, 4], [-239, 4], [-220, 3], [-220, -3], [-229, -4], [-229, 4], [14, -28], [70, -27], [64, -36], [58, -46], [50, -56], [41, -67], [31, -78], [20, -88], [8, -98], [10, -87], [11, -75], [12, -63], [12, -51], [13, -39], [14, 28], [70, 27], [64, 36], [58, 46], [50, 56], [41, 67], [31, 78], [20, 88], [8, 98], [10, 87], [11, 75], [12, 63], [12, 51], [13, 39]])
const POINTS_B = table([[0, 0]])
const TRIS_A = table([[0, 1, 2], [2, 3, 0], [4, 5, 6], [4, 6, 7], [4, 7, 1], [4, 1, 0], [4, 0, 8], [8, 9, 4], [10, 11, 12], [10, 12, 5], [10, 5, 4], [4, 13, 10], [14, 15, 16], [14, 16, 11], [14, 11, 10], [10, 17, 14], [18, 19, 20], [18, 20, 15], [18, 15, 14], [14, 21, 18], [22, 23, 24], [22, 24, 19], [22, 19, 18], [18, 25, 22], [26, 27, 28], [26, 28, 29], [26, 29, 23], [26, 23, 22], [26, 22, 30], [30, 31, 26], [32, 33, 27], [27, 26, 32], [34, 35, 36], [34, 36, 37], [34, 37, 38], [39, 40, 41], [42, 39, 41], [42, 41, 43], [42, 43, 44], [38, 42, 44], [34, 38, 44], [34, 44, 45], [34, 45, 46], [46, 47, 48], [46, 48, 49], [46, 49, 50], [34, 46, 50], [34, 50, 51], [34, 51, 52], [34, 52, 53], [34, 53, 54], [34, 54, 55], [34, 55, 56], [34, 56, 57], [34, 57, 58], [34, 58, 59], [34, 59, 60], [34, 60, 61], [34, 61, 62], [34, 62, 63], [34, 63, 64], [34, 64, 65], [65, 66, 67], [65, 67, 68], [65, 68, 69], [65, 69, 70], [65, 70, 71], [34, 65, 71], [71, 72, 34], [73, 74, 75], [73, 75, 76], [73, 76, 77], [77, 78, 73], [79, 80, 81], [79, 81, 74], [79, 74, 73], [73, 82, 79], [83, 84, 85], [83, 85, 80], [83, 80, 79], [79, 86, 83], [87, 88, 89], [87, 89, 90], [87, 90, 84], [87, 84, 83], [87, 83, 91], [91, 92, 87], [93, 94, 88], [88, 87, 93], [95, 96, 97], [97, 98, 95], [99, 100, 101], [99, 101, 102], [99, 102, 96], [96, 95, 103], [96, 103, 104], [96, 104, 99], [105, 106, 107], [105, 107, 100], [100, 99, 108], [100, 108, 105], [109, 110, 111], [109, 111, 112], [109, 112, 106], [106, 105, 113], [106, 113, 114], [106, 114, 109], [115, 116, 117], [115, 117, 110], [115, 110, 109], [109, 118, 115], [119, 120, 116], [116, 115, 119], [121, 122, 123], [121, 123, 124], [121, 124, 125], [121, 125, 126], [126, 127, 121], [128, 129, 130], [128, 130, 131], [128, 131, 122], [122, 121, 128], [132, 129, 128], [133, 134, 135], [133, 135, 136], [133, 136, 137], [133, 137, 138], [138, 139, 133], [140, 141, 142], [140, 142, 143], [140, 143, 134], [134, 133, 140], [144, 141, 140], [145, 146, 147], [145, 147, 148], [145, 148, 149], [149, 150, 145], [151, 152, 153], [151, 153, 146], [151, 146, 145], [145, 154, 151], [155, 156, 157], [155, 157, 158], [155, 158, 152], [155, 152, 151], [155, 151, 159], [159, 160, 155], [161, 162, 163], [161, 163, 156], [161, 156, 155], [155, 164, 161], [165, 166, 167], [165, 167, 162], [165, 162, 161], [161, 168, 165], [169, 170, 166], [166, 165, 169], [171, 172, 173], [174, 175, 176], [174, 176, 171], [174, 171, 173], [173, 177, 174], [178, 179, 180], [178, 180, 175], [178, 175, 174], [174, 181, 178], [182, 183, 184], [182, 184, 179], [182, 179, 178], [178, 185, 182], [186, 187, 188], [186, 188, 183], [186, 183, 182], [182, 189, 186], [190, 191, 192], [190, 192, 187], [190, 187, 186], [186, 193, 190], [194, 195, 196], [194, 196, 191], [194, 191, 190], [190, 197, 194], [198, 199, 200], [198, 200, 195], [198, 195, 194], [194, 201, 198], [204, 205, 206], [204, 206, 202], [202, 207, 204], [208, 209, 210], [208, 210, 205], [208, 205, 204], [204, 211, 208], [212, 213, 214], [212, 214, 215], [212, 215, 209], [212, 209, 208], [212, 208, 216], [216, 217, 212], [218, 219, 220], [218, 220, 213], [218, 213, 212], [212, 221, 218], [222, 223, 224], [222, 224, 225], [222, 225, 226], [222, 226, 227], [222, 227, 228], [222, 228, 229], [229, 230, 231], [229, 231, 232], [229, 232, 233], [222, 229, 233], [222, 233, 234], [234, 235, 222], [236, 237, 238], [236, 238, 239], [236, 239, 240], [236, 240, 241], [236, 241, 242], [236, 242, 243], [243, 244, 245], [243, 245, 246], [243, 246, 247], [236, 243, 247], [236, 247, 248], [248, 249, 236]], 'int')
const TRIS_B = table([[0, 0, 0]], 'int')
/** The part a point belongs to: 0 body, 1 head, 2 middle, 3 rear, 4 stalk, 5 and 6 the tail's lobes, 7 and 8 the pectorals. */
function partOf(index: number): number {
  return step(33.5, index) + step(72.5, index) + step(94.5, index) + step(144.5, index) + step(170.5, index) + step(201.5, index) + step(221.5, index) + step(235.5, index)
}
// mesh:end

/**
 * A value that stands for a whole number, read back whole. The app rounds each value to 10 bits of its range, so
 * 5 can arrive as 4.997, and \`floor\` alone would read it as 4.
 */
function whole(x: number): number {
  return floor(x + 0.5)
}

/** The drawing's size: the SVG's view box, laid over the window as `xMidYMid slice` lays it. */
const WIDE = 1600
const TALL = 1000

function hash(n: number): number {
  return fract(sin(n * 12.9898 + 78.233) * 43758.5453)
}

function hash2(p: Vec2): number {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)
}

/** Smooth value noise, 0 to 1. */
function noise(p: Vec2): number {
  const cell = floor(p)
  const f = fract(p)
  const u = vec2(f * f * (3 - 2 * f))
  const a = hash2(cell)
  const b = hash2(vec2(cell + vec2(1, 0)))
  const c = hash2(vec2(cell + vec2(0, 1)))
  const d = hash2(vec2(cell + vec2(1, 1)))

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y)
}

/** Three octaves of noise, 0 to 1. */
function fbm(p: Vec2): number {
  return noise(p) * 0.5 + noise(vec2(p * 2.03 + vec2(1.7, 9.2))) * 0.3 + noise(vec2(p * 4.01 + vec2(8.3, 2.8))) * 0.2
}

/** How many points a unit of the drawing takes on this window. */
function scale(): number {
  return max(size.x / WIDE, size.y / TALL)
}

/** A place in the drawing, as a place in the window, in points. */
function toWindow(at: Vec2): Vec2 {
  return vec2((at - vec2(WIDE / 2, TALL / 2)) * scale() + size * 0.5)
}

/** The shark's own pace, in the drawing's units a second: across the window in well under a minute. */
const CRUISE = 60

/** How fast the shark swims, in the drawing's units a second: its own pace, and two and a half times that in a rush. */
function pace(): number {
  return CRUISE * v.speed * (1 + 1.5 * v.rush)
}

/**
 * How far one sweep of the tail, there and back, carries the shark: half its length, as a fish's stride is. The
 * beat follows the distance swum, so a faster shark beats faster and the tail never works harder than it goes.
 */
function stride(): number {
  return 250 * (0.92 + hash(whole(v.seed) + 8) * 0.14) * v.size
}

/** How fast the water flows: its own pace, and three times that in a rush. */
function current(): number {
  return v.flow * (1 + 2 * v.rush)
}

/** The tightest turn the shark makes, as a radius in the drawing's units. */
const TIGHTEST = 300

/**
 * A place in the window, in points as a pixel and the pointer give them, as a place in the drawing. Those points
 * count up from the bottom of the window and the drawing counts down from its top, so y is turned over: read the
 * other way, the ribbons' light lay under them and the shark swam to the pointer's mirror image.
 */
function inDrawing(point: Vec2): Vec2 {
  return vec2((vec2(point.x, size.y - point.y) - size * 0.5) / scale() + vec2(WIDE / 2, TALL / 2))
}

/**
 * How fast to turn, in radians a second, to head from \`at\` toward \`target\`: \`keen\` times how far off it heads,
 * up to \`most\` either way.
 */
function toward(at: Vec2, heading: number, target: Vec2, keen: number, most: number): number {
  const off = atan(target.y - at.y, target.x - at.x) - heading

  return clamp(atan(sin(off), cos(off)) * keen, -most, most)
}

// How the shark takes an interest in the pointer, so it is curious and not chained to it:
// - its interest grows over a second and a half while the pointer moves, and fades over four once it stops;
// - it heads for a place that drifts after the pointer, a second behind, so a jittering hand is a smooth aim;
// - it turns no faster than 0.6 radians a second, a set rate whatever its pace, and that rate itself changes by
//   at most 0.5 a second each second, so it swings into a turn and out of it and never snaps round;
// - it judges the pointer from its head: within about 200 units of it its interest falls away, so it passes by
//   and loops back rather than spinning on the spot; beyond 500 it fades to half; and behind its eyeline, to half;
// - at its keenest the pointer has four parts in five of its say, and its own wandering keeps the rest.
const KEENEST = 0.6
const SWING = 0.5

// The shark swims free. Each frame it moves ahead at its pace and turns at a rate that eases toward the turn it
// wants: a slow, random wandering; a turn back toward the middle of the drawing as it nears the edge of the
// conversation; and, while the pointer moves, a turn toward the pointer, let go within a second of it stopping.
// Its pace never changes for any of them. Three texels: the first holds where it is (xy), its heading (z) and how
// far through its tail's beat it is (w); the second the water's clock (x), how much it follows the pointer (y), how
// fast it turns (z) and its wandering's clock (w); the third where it last saw the pointer move (xy).
const swim: Buffer = buffer({ size: [3, 1], float: 32, filter: 'nearest' }, p => {
  const s = whole(v.seed)
  const a = swim.at(vec2(0, 0))
  const b = swim.at(vec2(1, 0))
  const speed = pace()
  const most = speed / TIGHTEST
  const c = swim.at(vec2(2, 0))
  const wander = (noise(vec2(b.w * 0.07, s * 0.37)) * 2 - 1) * most * 0.8
  const from = vec2((a.x - WIDE / 2) / 476, (a.y - TALL / 2) / 403)
  const home = toward(a.xy, a.z, vec2(WIDE / 2, TALL / 2), 0.8, most)
  let want = mix(wander, home, smoothstep(0.7, 1.05, length(from)))
  const hand = pointer(0)
  const isMoving = step(0.5, pointerCount) * step(0.5, length(hand.at - hand.was)) * (1 - step(0.001, hand.gone))
  // The app may hand the pointer over only now and then, so the aim drifts toward where it was last seen moving.
  const follow = clamp(isMoving > 0.5 ? b.y + dt / 1.5 : b.y - dt / 4, 0, 1)
  const seen = isMoving > 0.5 ? vec2(mix(c.xy, inDrawing(hand.at), min(1, dt))) : c.xy
  // Measured from its head, where it looks from, not from where it rides its route.
  const facing = vec2(cos(a.z), sin(a.z))
  const head = vec2(a.xy + facing * 130 * (0.92 + hash(s + 8) * 0.14) * v.size)
  const gap = seen - head
  const far = length(gap)
  // Close to its head it lets go and swims past; far off it cares less; behind it, out of its eyeline, less again.
  const reach = smoothstep(90, 220, far) * (1 - 0.5 * smoothstep(500, 900, far))
  const sight = mix(0.5, 1, smoothstep(-0.6, 0, dot(facing, gap / max(far, 1))))
  want = mix(want, toward(head, a.z, seen, 1.2, KEENEST), follow * reach * sight * 0.8)
  const rate = b.z + clamp(want - b.z, -SWING * dt, SWING * dt)
  const heading = mod(a.z + rate * dt + PI, 2 * PI) - PI
  const ahead = vec4(a.xy + vec2(cos(heading), sin(heading)) * speed * dt, heading, fract(a.w + (dt * speed) / stride()))
  // The two clocks wrap every 10,000 seconds: a float kept counting loses the precision a frame's step needs after
  // a day or two, and the flow would stutter in a window left open.
  const after = vec4(mod(b.x + dt * current(), 10000), follow, rate, mod(b.w + dt, 10000))
  const start = vec4(WIDE / 2 + (hash(s + 5) - 0.5) * 500, TALL / 2 + (hash(s + 6) - 0.5) * 300, (hash(s + 3) - 0.5) * 6.28, hash(s + 4))
  const begun = vec4(hash(s + 7) * 100, 0, 0, hash(s + 9) * 100)
  const target = vec4(seen, 0, 1)

  return p.cell.x < 0.5 ? (first ? start : ahead) : p.cell.x < 1.5 ? (first ? begun : after) : first ? vec4(WIDE / 2, TALL / 2, 0, 1) : target
})

// A click sends a ring across the water. The last four are kept, one a texel: where the press was, in the window's
// own points (xy), how long ago (z), and 1 for a ring that is there (w). A fifth texel holds whether the pointer
// was down last frame (x) and which texel the next press takes (y).
const RINGS = 4
const rings: Buffer = buffer({ size: [RINGS + 1, 1], float: 32, filter: 'nearest' }, p => {
  const slot = floor(p.cell.x)
  const was = rings.at(vec2(slot, 0))
  const book = rings.at(vec2(RINGS, 0))
  const hand = pointer(0)
  const isPress = step(0.5, pointerCount) * step(0.5, hand.down) * (1 - step(0.5, book.x))
  const isMine = isPress * (1 - step(0.5, abs(book.y - slot)))
  const ring = isMine > 0.5 ? vec4(hand.at, 0, 1) : vec4(was.xy, was.z + dt, was.w * step(was.z, 4))
  const next = vec4(step(0.5, pointerCount) * step(0.5, hand.down), mod(book.y + isPress, RINGS), 0, 1)

  return first ? vec4(0, 0, 99, 0) : slot > RINGS - 0.5 ? next : ring
})

/**
 * How much light the rings' crests lay on the water here (x) and how much shade their troughs (y). They light the
 * water and do not move it: reading the picture at a place a ring's buffer gave would cost three times as much.
 */
function ripple(point: Vec2): Vec2 {
  let lit = 0
  let dark = 0
  for (const i of range(RINGS)) {
    const ring = rings.at(vec2(i, 0))
    const far = length(point - ring.xy)
    // The ring runs out at 220 units a second and fades over two and a half seconds, weaker as it widens.
    const reach = ring.z * 220 * scale()
    const width = 26 * scale()
    const crest = exp(-((far - reach) * (far - reach)) / (width * width)) * ring.w * max(0, 1 - ring.z / 2.5)
    const wave = sin((far - reach) / width * 3) * crest
    lit = lit + max(wave, 0) * 0.7
    dark = dark + max(-wave, 0) * 0.35
  }

  return vec2(min(lit, 1), min(dark, 1))
}

/** A point turned about a hinge on the body's axis, by degrees; with y down, a positive turn is clockwise. */
function hinge(p: Vec2, x: number, degrees: number): Vec2 {
  const a = (degrees * PI) / 180
  const c = cos(a)
  const s = sin(a)
  const d = vec2(p - vec2(x, 0))

  return vec2(x + d.x * c - d.y * s, d.x * s + d.y * c)
}

/** How far a hinge has swung at this point in the beat: `swing` degrees either way, `lag` of a beat behind the head. */
function swung(swing: number, lag: number, at: number): number {
  return -swing * cos(2 * PI * (at + 1 - lag))
}

/** 1 when `part` is from `low` to `high`, else 0. */
function among(part: number, low: number, high: number): number {
  return step(low - 0.5, part) * step(part, high + 0.5)
}

/** The point a vertex stands on: its triangle's corner, looked up in the mesh. */
function pointOf(vertex: number): number {
  const triangle = floor(vertex / 3)
  const corner = vertex - triangle * 3
  const corners = triangle < 256 ? TRIS_A.at(triangle) : TRIS_B.at(triangle - 256)

  return signed(corner < 0.5 ? corners[0] : corner < 1.5 ? corners[1] : corners[2])
}

// The body as one spine, measured in the shark's own units back from the point it rides its route at (x = 20, by
// the pectorals): its heading at each place is the sum of how it curves on the way there, and its shape is the
// sum of those headings. One curvature makes every motion: a share of the route's own turn, so the body arcs
// into a turn, and a wave that runs from the head down to the tail, so it swims. Nothing is laid on top.

/** Where the spine is held to the route, and where it starts and ends (the neck and the tail's tip). */
const HELD = 20
const NECK = 86
const TIP = -352
/** How many steps the spine is summed in. */
const STEPS = 12
/** How much of the route's turn the body takes: less than all, so a long shark does not curl round a tight one. */
const ARC = 0.45
/** The swim wave: one wavelength a little over the body's length, strongest at the tail. */
const WAVE = 520
const SWIM = 0.004

/** How far a place on the spine is behind the nose, as a share of the body: 0 at the neck, 1 at the tail's tip. */
function back(x: number): number {
  return clamp((NECK - x) / (NECK - TIP), 0, 1)
}

/** How the body curves at `x`, in radians a unit, turning to the right as the heading is followed back. */
function curve(x: number, beatAt: number, turn: number): number {
  const b = back(x)
  const swim = SWIM * (0.2 + 0.8 * b * sqrt(b)) * (1 + 0.4 * min(abs(turn) * 260, 1)) * (1 + 0.3 * v.rush)

  return -turn * ARC + swim * sin(2 * PI * beatAt - (2 * PI * (NECK - x)) / WAVE)
}

/**
 * The spine at `x`: where it is (xy) and which way it heads (z), from the held point, taken as at the origin heading
 * along +x. Summed in STEPS steps from the held point, toward the tail or toward the neck.
 */
function spine(x: number, beatAt: number, turn: number): Vec3 {
  const step = (x - HELD) / STEPS
  let heading = 0
  let at = vec2(0, 0)
  for (const i of range(STEPS)) {
    const middle = HELD + step * (i + 0.5)
    // Back toward the tail (a negative step), the heading changes by the curve; forward, against it.
    const turned = heading - curve(middle, beatAt, turn) * step * 0.5
    at = vec2(at + vec2(cos(turned), sin(turned)) * step)
    heading = heading - curve(middle, beatAt, turn) * step
  }

  return vec3(at, heading)
}

/**
 * How far the whole body leans off its held heading, on average: a fish's head swings against its tail, so the
 * shark is turned back by this much and its body as a whole keeps to the route.
 */
function lean(beatAt: number, turn: number): number {
  const step = (TIP - NECK) / STEPS
  let heading = spine(NECK, beatAt, turn).z
  let sum = 0
  for (const i of range(STEPS)) {
    const middle = NECK + step * (i + 0.5)
    sum = sum + (heading - curve(middle, beatAt, turn) * step * 0.5)
    heading = heading - curve(middle, beatAt, turn) * step
  }

  return sum / STEPS
}

/** Where a vertex of the shark is, in the window's clip space, for the shadow (\`isShadow\` 1) or the shark. */
function placed(vertex: number, isShadow: number): { at: number; hide: boolean } {
  const index = pointOf(vertex)
  const point: Vec2 = index < 256 ? POINTS_A.at(index) : POINTS_B.at(index - 256)
  const part = partOf(index)
  const at = swim.at(vec2(0, 0))
  const here = at.xy
  const after = at.z
  const beatAt = at.w
  const grown = (0.92 + hash(whole(v.seed) + 8) * 0.14) * v.size
  // How hard it turns, in radians a unit swum.
  const turn = swim.at(vec2(1, 0)).z / pace()
  // The tail's two lobes open into a fork as the tail sweeps, as in scene.ts.
  let p = hinge(point, -224, swung(mix(6, -5, step(5.5, part)), 0.68, beatAt) * among(part, 5, 6))
  // Banking into a turn: the inner pectoral looks shorter from above, the outer one longer.
  const bank = clamp(-turn * 260, -1, 1)
  const side = mix(1, -1, step(7.5, part))
  const root = -27 * side
  p = vec2(p.x, mix(p.y, root + (p.y - root) * (1 - side * bank * 0.3), among(part, 7, 8)))
  // A rigid part rides the spine at one place: the head at the neck, the pectorals at their roots.
  const isRigid = among(part, 1, 1) + among(part, 7, 8)
  const ride = mix(p.x, mix(NECK, 40, step(6.5, part)), isRigid)
  const on = spine(ride, beatAt, turn)
  const heading = after + on.z - lean(beatAt, turn)
  const along = vec2(cos(heading), sin(heading))
  const right = vec2(-along.y, along.x)
  // The spine's own place, turned by the lean, then the point off it: ahead by the rigid part's reach, and right.
  const swing = after - lean(beatAt, turn)
  const spun = vec2(on.x * cos(swing) - on.y * sin(swing), on.x * sin(swing) + on.y * cos(swing))
  const drawn = here + (spun + along * (p.x - ride) + right * p.y) * grown + vec2(18, 28) * v.size * isShadow
  const w = toWindow(vec2(drawn))

  return { at: vec4(w.x / size.x * 2 - 1, 1 - w.y / size.y * 2, 0, 1), hide: mod(whole(v.kinds), 2) < 0.5 }
}

// The shark as a mask: red where its shadow falls, green where it is. As sharp as the picture, and read through
// four taps half a point apart, so its edges are smooth and not stepped.
const mask: Buffer = buffer({ scale: 2, filter: 'linear' })
const shadow = shapes({ count: VERTICES, cover: 0.3, into: mask, clear: true }, vertex => placed(vertex, 1), () => vec4(1, 0, 0, 1))
const body = shapes({ count: VERTICES, cover: 0.3, into: mask }, vertex => placed(vertex, 0), () => vec4(0, 1, 0, 1))

// The soft light on the water, which changes slowly across the window, so it is worked out on a coarse grid and
// read smoothed: the click rings' light (x), the ribbons' bands (y), the drifting light (z) and the rings' shade (w).
const flow: Buffer = buffer({ scale: 0.125, float: 16 }, p => {
  const t = swim.at(vec2(1, 0)).x
  const q = vec2(p.point * 0.0016)
  const warp = vec2(fbm(vec2(q + vec2(0, t * 0.03))), fbm(vec2(q + vec2(5.2, 1.3) - t * 0.02)))
  const swirl = vec2(fbm(vec2(q + warp * 1.8 + vec2(1.7, 9.2) + t * 0.015)), fbm(vec2(q + warp * 1.8 + vec2(8.3, 2.8) - t * 0.012)))
  const glow = fbm(vec2(q * 0.7 + swirl * 2.2 + vec2(t * 0.01, 0)))
  const light = smoothstep(0.52, 0.66, glow) * (1 - smoothstep(0.66, 0.84, glow))

  // The ribbons' bands are soft, so they are worked out here, on the coarse grid.
  const at = inDrawing(p.point)
  let band = 0
  for (const i of range(RIBBONS)) {
    band = max(band, ribbon(at, i, 1, 0).x)
  }

  // The rings are soft too, so their light (x) and shade (w) are worked out here as well.
  const rippled = ripple(p.point)

  return vec4(rippled.x, band, light, rippled.y)
})

// The ribbons of light, drawn as scene.ts draws them: a band between two sine curves that swells and thins, its
// crest along the upper curve fading in and out along its length. Here each also drifts sideways and rises and
// falls on its own clock. What a ribbon is this frame is worked out once, in a texel of its own: x is its upper
// curve's height, y its phase, z its wavelength, w its lower curve's height and twist packed apart below.
const RIBBONS = 7
const ribbons: Buffer = buffer({ size: [RIBBONS, 2], float: 32, filter: 'nearest' }, p => {
  const i = floor(p.cell.x)
  const k = whole(v.seed) * 13 + i * 7
  const t = swim.at(vec2(1, 0)).x
  const count = 3 + 2 * floor(whole(v.kinds) / 2)
  const wave = 420 + hash(k + 1) * 560
  const lift = 16 + hash(k + 2) * 44
  const base = 90 + (i + hash(k + 3) * 0.9) * (820 / count)
  // Sideways at 8 to 20 units a second, one way or the other, and up and down on a period of 14 to 32 seconds.
  const drift = (8 + hash(k + 6) * 12) * (step(0.5, hash(k + 7)) * 2 - 1) * t
  const rise = sin((2 * PI * t) / (14 + hash(k + 8) * 18) + hash(k + 9) * 6.28) * lift * 0.7
  const phase = hash(k + 10) * 6.28 - (2 * PI * drift) / wave
  // A ribbon past the chosen count is moved out of the drawing.
  const shown = step(i + 0.5, count)
  const upper = vec4(mix(-9999, base + rise, shown), phase, wave, lift)
  const second = vec4(60 + hash(k + 4) * 120, 0.7 + hash(k + 5) * 1.5, 0, 0)

  return p.cell.y < 1 ? upper : second
})

/** A ribbon's band (x) and its crest (y) at a place in the drawing, each 0 to 1; `isCrest` 0 skips the crest. */
function ribbon(at: Vec2, i: number, px: number, isCrest: number): Vec2 {
  const a = ribbons.at(vec2(i, 0))
  const b = ribbons.at(vec2(i, 1))
  const angle = a.y + (2 * PI * at.x) / a.z
  const top = a.x + a.w * sin(angle)
  const bottom = a.x + b.x + a.w * sin(angle + b.y)
  const depth = (at.y - top) / max(bottom - top, 1)
  const band = step(0, depth) * step(depth, 1) * mix(1 - depth * 1.25, 0.25 - (depth - 0.6) * 0.625, step(0.6, depth))
  // The crest is 1.6 units wide, softened over a pixel; it fades along its length every 760 units, as the SVG's does.
  const along = abs(fract(at.x / 760) * 2 - 1)
  const crest = (1 - smoothstep(0.8, 0.8 + px, abs(at.y - top))) * (1 - 0.88 * (1 - along)) * isCrest

  return vec2(band, crest)
}

/** A color's luminance, for a color in linear light. */
function luma(linear: Vec3): number {
  return dot(linear, vec3(0.2126, 0.7152, 0.0722))
}

/**
 * A color in linear light, moved lighter (`lighter` 1) or darker (0) until it stands `target` apart from itself in
 * contrast, keeping its hue. `l` is its luminance.
 */
function shade(linear: Vec3, l: number, target: number, lighter: number): Vec3 {
  const up = min(1, target * (l + 0.05) - 0.05)
  const down = max(0, (l + 0.05) / target - 0.05)
  const raised = linear + (1 - linear) * ((up - l) / max(1 - l, 0.001))
  const lowered = linear * (down / max(l, 0.0001))

  return vec3(mix(lowered, raised, lighter))
}

const sea = shader({
  fps: 30,
  passes: [
    swim,
    rings,
    ribbons,
    mask,
    shadow,
    body,
    flow,
    picture(p => {
      const bend = flow.sample(p.uv)
      // The water bends on a few crossing sines, each bent by another, so its ribbons wind and never repeat in
      // step. Worked here and not read from \`flow\`: a picture read at a place another read gave costs far more.
      const t = swim.at(vec2(1, 0)).x
      const q = vec2(p.point / scale())
      const sway = vec2(
        sin(q.y * 0.006 + t * 0.21 + sin(q.x * 0.004 - t * 0.13) * 1.3) + sin(q.x * 0.011 + t * 0.07) * 0.4,
        sin(q.x * 0.005 - t * 0.17 + sin(q.y * 0.007 + t * 0.11) * 1.1) + sin(q.y * 0.013 - t * 0.09) * 0.4,
      )
      const spot = vec2(p.uv + (sway * 16 * scale()) / size)
      const here = scene.sample(spot).rgb
      // The still sea's glints hold still under a shader, so they twinkle here: where this pixel differs from the
      // water six points beside it, it is a glint, and each fades in and out on its own eleven-second clock.
      const beside = scene.sample(vec2(spot + vec2(6, 0) / size)).rgb
      const glint = smoothstep(0.01, 0.05, length(here - beside))
      const twinkle = 0.5 + 0.5 * sin((2 * PI * t) / 11 + hash2(vec2(floor(inDrawing(p.point) / 28))) * 6.28)
      const water = vec3(mix(beside, here, min(1, glint * twinkle * 1.8) + (1 - glint)))
      // Worked in linear light, with a square for the curve: close to sRGB's, and far cheaper than a power.
      const linear = vec3(water * water)
      const l = luma(linear)
      // Dark water is under the luminance where black and white stand equally far from it. Every shipped dark
      // scheme's water lies between 0.009 and 0.041 and every light one's between 0.59 and 0.71; a line at 0.02 turned the
      // shark black on five dark schemes, Gruvbox among them.
      const isDark = 1 - step(0.18, l)
      // Light drifting over the water, as strong as the ribbons: stronger in a deeper sea.
      let color = mix(linear, shade(linear, l, 1 + v.depth * 0.05, 1), bend.z * 0.8)
      const half = vec2(0.5 / size.x, 0.5 / size.y)
      const shark = vec4(
        (mask.sample(p.uv + half) + mask.sample(p.uv - half) + mask.sample(p.uv + vec2(half.x, -half.y)) + mask.sample(p.uv + vec2(-half.x, half.y))) * 0.25,
      )
      const dim = min(0.8, mix(0.35, 0.5, isDark) * (0.4 + v.depth * 0.2))
      color = mix(color, shade(linear, l, 1.5, 0), shark.x * dim)
      color = mix(color, shade(linear, l, 1.2 + v.tone * 0.3, isDark), shark.y)
      // The ribbons lie over the shark, as light on the water does: their bands from the coarse grid, their thin
      // crests worked out here, where they stay sharp.
      const at = inDrawing(p.point)
      const light = shade(linear, l, 1 + v.depth * 0.1, 1)
      let crest = 0
      for (const i of range(RIBBONS)) {
        crest = max(crest, ribbon(at, i, 1 / scale(), 1).y)
      }
      color = mix(color, light, bend.y * 0.5)
      color = mix(color, light, crest)
      // A click's rings, from the coarse grid: light on their crests, shade in their troughs.
      color = mix(color, light, bend.x)
      color = mix(color, shade(linear, l, 1.3, 0), bend.w)

      return vec4(sqrt(max(color, vec3(0))), 1)
    }),
  ],
})

export default sea
