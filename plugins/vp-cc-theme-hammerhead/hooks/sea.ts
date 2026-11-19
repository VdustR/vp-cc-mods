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
const VERTICES = 405
const LINE_VERTICES = 306
const POINTS_A = table([[0, 0], [0, 36], [-23, 34], [-29, 34], [-29, 0], [30, 0], [30, 39], [60, 0], [60, 38], [57, 39], [41, 39], [90, 0], [90, 31], [89, 31], [80, 34], [70, 37], [104, 0], [104, 27], [98, 30], [20.1, 35], [32.6, 32.9], [20.5, 36], [8.8, 36.7], [-2.9, 35.5], [-14.4, 33], [-22, 30.7], [-22, 28.6], [-17.5, 29.9], [-5, 33], [7.6, 34.9], [81.2, 25.2], [85.2, 14.3], [82.7, 25.6], [74.5, 34], [73.3, 26], [77.3, 15], [74.8, 26.4], [66.6, 34.7], [65.4, 26.3], [69.5, 15.4], [66.9, 26.7], [58.7, 35.1], [98, 0], [98, 0.5], [68.1, 0.7], [27, 0.9], [-17, 1], [-22, 1], [-22, 0], [93, 0], [151, 0], [154, 12], [156, 24], [154, 36], [150, 46], [147, 58], [148, 70], [152, 81], [155, 88], [146, 95], [135, 99], [124, 100], [113, 94], [112, 82], [114, 69], [117, 57], [116, 45], [113, 36], [106, 31], [98, 30], [93, 31], [128.2, 95.1], [140.3, 92.7], [127.6, 96], [118.3, 93.2], [115.3, 85.9], [117.2, 76], [120.3, 65.5], [123, 54.8], [114.9, 26.9], [105.3, 22.9], [115.9, 26.3], [121, 33.9], [123, 33.3], [123.5, 44], [125.3, 43.3], [124.9, 55.3], [122.2, 66.5], [118.9, 76.6], [116.7, 85.6], [119.3, 92.7], [98, 0], [138.5, 0], [105.5, 0.4], [98, 0.5], [-90, 0], [-90, 22], [-93, 22], [-93, 0], [-60, 0], [-60, 27], [-64, 26], [-76, 23], [-86, 22], [-30, 0], [-30, 33], [-37, 32], [-51, 29], [-17, 0], [-17, 35], [-23, 34], [-22, 28.6], [-22, 30.7], [-25.8, 29.5], [-37.2, 25.8], [-49.8, 22.2], [-75.8, 17.3], [-86, 16.1], [-86, 14.6], [-62.7, 19.5], [-75.6, 15.6], [-63.9, 17.4], [-52.7, 19.7], [-42.2, 22.6], [-30, 26.3], [-22, 0], [-22, 1], [-63.1, 1.1], [-86, 1.1], [-86, 0], [-150, 0], [-150, 23], [-158, 23], [-164, 22], [-164, 0], [-120, 0], [-120, 23], [-90, 0], [-90, 22], [-98, 21], [-109, 22], [-118, 23], [-80, 0], [-80, 22], [-86, 22], [-150, 41], [-154, 43], [-165, 45], [-176, 44], [-168, 36], [-162, 29], [-120, 24], [-126, 27], [-134, 33], [-142, 39], [-86, 14.6], [-86, 16.1], [-88.9, 15.8], [-101.8, 14.7], [-114.6, 14], [-100.9, 13.8], [-87.9, 14.4], [-132.6, 26.4], [-144, 33.9], [-158.2, 39.7], [-123.9, 21.5], [-147.2, 33.6], [-137.5, 26.3], [-131, 21.1], [-133.4, 19.6], [-167.5, 15], [-155.8, 16.3], [-144.2, 17.9], [-86, 0], [-86, 1.1], [-110.6, 1], [-158, 0.9], [-158, 0], [-270, 0], [-270, 8], [-273, 8], [-273, 0], [-240, 0], [-240, 7], [-246, 7], [-257, 7], [-266, 8], [-210, 0], [-210, 10], [-221, 9], [-234, 8], [-180, 0], [-180, 15], [-193, 13], [-207, 11], [-153, 0], [-153, 23], [-158, 23], [-168, 19], [-158, 0], [-158, 0.9], [-158.8, 0.9], [-206.8, 0.7], [-254, 0.4], [-266, 0.3], [-266, 0], [-330, 38], [-330, 54], [-339, 57], [-352, 60], [-340, 49], [-300, 0], [-300, 32], [-301, 34], [-309, 41], [-318, 48], [-328, 53], [-323, 28], [-317, 19], [-312, 11], [-306, 5], [-270, 0], [-270, 9], [-277, 11], [-286, 16], [-294, 24], [-260, 0], [-260, 9], [-266, 8], [-281.6, 5.4], [-270.3, 4.7], [-283.6, 7.5], [-293.7, 15.4], [-302.2, 25.4], [-309.1, 33.3], [-316.8, 40.3], [-324.7, 45.8], [-314.3, 35.4], [-306.3, 25.6], [-298.2, 15.4], [-290.7, 8.9], [-266, 0.3], [-299.6, 0], [-266, 0], [-23, 34], [41, 39], [34, 44], [26, 52], [19, 62], [11, 73], [2, 84], [-8, 95], [-18, 105], [-28, 114], [-38, 122], [-48, 129]])
const POINTS_B = table([[-58, 135], [-51, 124], [-45, 113], [-39, 101], [-33, 89], [-29, 77], [-24, 65], [-20, 53], [-18, 41], [-31.3, 104.5], [-39, 115.3], [-32.3, 103.1], [-25.8, 90.2], [-20, 77.3], [-12.1, 39.3], [-17.2, 34.4], [-10.1, 38.7], [-10.4, 45.5], [-8.2, 45.8], [-11.9, 54.2], [-15.3, 65.1], [-9.5, 56.3], [-12.9, 68], [-17.9, 80.3], [-24.1, 92.7]])
const TRIS_A = table([[0, 1, 2], [0, 2, 3], [3, 4, 0], [5, 6, 1], [1, 0, 5], [7, 8, 9], [7, 9, 10], [7, 10, 6], [6, 5, 7], [11, 12, 13], [11, 13, 14], [11, 14, 15], [11, 15, 8], [8, 7, 11], [16, 17, 18], [16, 18, 12], [12, 11, 16], [49, 50, 51], [49, 51, 52], [49, 52, 53], [49, 53, 54], [49, 54, 55], [49, 55, 56], [49, 56, 57], [49, 57, 58], [49, 58, 59], [59, 60, 61], [59, 61, 62], [59, 62, 63], [59, 63, 64], [59, 64, 65], [59, 65, 66], [59, 66, 67], [49, 59, 67], [49, 67, 68], [49, 68, 69], [69, 70, 49], [95, 96, 97], [97, 98, 95], [99, 100, 101], [99, 101, 102], [99, 102, 103], [99, 103, 96], [96, 95, 99], [104, 105, 106], [104, 106, 107], [104, 107, 100], [100, 99, 104], [108, 109, 110], [108, 110, 105], [105, 104, 108], [130, 131, 132], [130, 132, 133], [133, 134, 130], [135, 136, 131], [131, 130, 135], [137, 138, 139], [137, 139, 140], [137, 140, 141], [137, 141, 136], [136, 135, 137], [142, 143, 144], [142, 144, 138], [138, 137, 142], [131, 145, 146], [131, 146, 147], [131, 147, 148], [131, 148, 149], [131, 149, 150], [150, 132, 131], [136, 151, 152], [152, 153, 154], [152, 154, 145], [136, 152, 145], [145, 131, 136], [141, 151, 136], [178, 179, 180], [180, 181, 178], [182, 183, 184], [182, 184, 185], [182, 185, 186], [182, 186, 179], [179, 178, 182], [187, 188, 189], [187, 189, 190], [187, 190, 183], [183, 182, 187], [191, 192, 193], [191, 193, 194], [191, 194, 188], [188, 187, 191], [195, 196, 197], [195, 197, 198], [195, 198, 192], [192, 191, 195], [206, 207, 208], [208, 209, 210], [208, 210, 206], [211, 212, 213], [211, 213, 214], [211, 214, 215], [211, 215, 216], [211, 216, 207], [211, 207, 206], [211, 206, 217], [211, 217, 218], [211, 218, 219], [219, 220, 211], [221, 222, 223], [221, 223, 224], [221, 224, 225], [225, 212, 211], [221, 225, 211], [226, 227, 228], [226, 228, 222], [222, 221, 226], [244, 245, 246], [244, 246, 247], [244, 247, 248], [244, 248, 249], [249, 250, 251], [249, 251, 252], [249, 252, 253], [249, 253, 254], [249, 254, 255], [249, 255, 256], [249, 256, 257], [249, 257, 258], [249, 258, 259], [249, 259, 260], [249, 260, 261], [249, 261, 262], [249, 262, 263], [249, 263, 264], [249, 264, 244], [19, 20, 21], [19, 21, 22], [19, 22, 23], [23, 24, 25], [23, 25, 26], [23, 26, 27], [23, 27, 28], [23, 28, 29], [23, 29, 19], [30, 31, 32], [32, 33, 30], [34, 35, 36], [36, 37, 34], [38, 39, 40], [40, 41, 38], [42, 43, 44], [42, 44, 45], [42, 45, 46], [42, 46, 47], [47, 48, 42], [71, 72, 73], [71, 73, 74], [75, 76, 77], [75, 77, 78], [79, 80, 81], [82, 79, 81], [82, 81, 83], [84, 82, 83], [84, 83, 85], [78, 84, 85], [78, 85, 86], [75, 78, 86], [75, 86, 87], [75, 87, 88], [75, 88, 89], [74, 75, 89], [74, 89, 90], [74, 90, 71], [91, 92, 93], [93, 94, 91], [111, 112, 113], [111, 113, 114], [111, 114, 115], [116, 117, 118], [119, 116, 118], [115, 119, 118], [115, 118, 120], [111, 115, 120], [111, 120, 121], [121, 122, 123], [121, 123, 124], [121, 124, 111], [125, 126, 127], [125, 127, 128], [128, 129, 125], [155, 156, 157], [155, 157, 158], [155, 158, 159], [155, 159, 160], [160, 161, 155], [162, 163, 164], [165, 162, 164], [165, 164, 166], [165, 166, 167], [165, 167, 168], [169, 165, 168], [169, 168, 170], [169, 170, 171], [171, 172, 169], [173, 174, 175], [173, 175, 176], [176, 177, 173], [199, 200, 201], [199, 201, 202], [199, 202, 203], [199, 203, 204], [204, 205, 199], [229, 230, 231], [229, 231, 232], [232, 233, 234], [232, 234, 235], [232, 235, 236], [232, 236, 237], [232, 237, 238], [229, 232, 238], [229, 238, 239], [239, 240, 229], [241, 242, 243], [265, 266, 267], [265, 267, 268], [265, 268, 269], [270, 271, 272], [273, 270, 272], [273, 272, 274], [275, 273, 274], [276, 275, 274], [276, 274, 277], [269, 276, 277], [265, 269, 277], [265, 277, 278], [265, 278, 279], [279, 280, 265]], 'int')
const TRIS_B = table([[0, 0, 0]], 'int')
/** The part a point belongs to: 0 body, 1 head, 2 middle, 3 rear, 4 stalk, 5 the tail, 6 and 7 the pectorals. */
function partOf(index: number): number {
  return step(48.5, index) + step(94.5, index) + step(129.5, index) + step(177.5, index) + step(205.5, index) + step(243.5, index)
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

/**
 * The point a vertex stands on: its triangle's corner, looked up in the mesh. A mirrored triangle takes its corners
 * in the other order, so it winds the same way as the one it mirrors.
 */
function pointOf(vertex: number, isMirror: number): number {
  const triangle = floor(vertex / 3)
  const kept = vertex - triangle * 3
  const corner = mix(kept, mod(3 - kept, 3), isMirror)
  const corners = triangle < 256 ? TRIS_A.at(triangle) : TRIS_B.at(triangle - 256)

  return signed(corner < 0.5 ? corners[0] : corner < 1.5 ? corners[1] : corners[2])
}

// The body as one spine, measured in the shark's own units back from the point it rides its route at (x = 20, by
// the pectorals): its heading at each place is the sum of how it curves on the way there, and its shape is the
// sum of those headings. One curvature makes every motion: a share of the route's own turn, so the body arcs
// into a turn, and a wave that runs from the head down to the tail, so it swims. Nothing is laid on top.

/** Where the spine is held to the route, and where it starts and ends (the neck and the tail's tip). */
const HELD = 20
const NECK = 98
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

/**
 * Where a vertex of the shark is, in the window's clip space, for the shadow (\`isShadow\` 1) or the shark, its
 * silhouette or its line art (\`isLine\` 1). The mesh holds the right half, so each pass draws its triangles twice:
 * the first \`half\` vertices as they are, the rest mirrored across the body's axis into the left half.
 */
function placed(vertex: number, isShadow: number, isLine: number): { at: number; hide: boolean } {
  const half = mix(VERTICES, LINE_VERTICES, isLine)
  const isMirror = step(half - 0.5, vertex)
  const index = pointOf(vertex - isMirror * half + isLine * VERTICES, isMirror)
  const kept: Vec2 = index < 256 ? POINTS_A.at(index) : POINTS_B.at(index - 256)
  const point = vec2(kept.x, kept.y * (1 - 2 * isMirror))
  const part = partOf(index)
  const at = swim.at(vec2(0, 0))
  const here = at.xy
  const after = at.z
  const beatAt = at.w
  const grown = (0.92 + hash(whole(v.seed) + 8) * 0.14) * v.size
  // How hard it turns, in radians a unit swum.
  const turn = swim.at(vec2(1, 0)).z / pace()
  // The forked tail flicks on the end of the stalk, as in scene.ts.
  let p = hinge(point, -266, swung(6, 0.68, beatAt) * among(part, 5, 5))
  // Banking into a turn: the inner pectoral looks shorter from above, the outer one longer.
  const bank = clamp(-turn * 260, -1, 1)
  // The pectoral as kept is the right one; mirrored, it is the left.
  const side = mix(-1, 1, isMirror)
  const root = -37 * side
  p = vec2(p.x, mix(p.y, root + (p.y - root) * (1 - side * bank * 0.3), among(part, 6, 6)))
  // A rigid part rides the spine at one place: the head at the neck, the pectorals at their roots.
  const isRigid = among(part, 1, 1) + among(part, 6, 6)
  const ride = mix(p.x, mix(NECK, 9, step(5.5, part)), isRigid)
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

// The shark as a mask: red where its shadow falls, green where it is, blue where its line art is. As sharp as the
// picture, and read through four taps half a point apart, so its edges are smooth and not stepped. The lines keep
// green, so they stay on the shark.
const mask: Buffer = buffer({ scale: 2, filter: 'linear' })
const shadow = shapes({ count: VERTICES * 2, cover: 0.3, into: mask, clear: true }, vertex => placed(vertex, 1, 0), () => vec4(1, 0, 0, 1))
const body = shapes({ count: VERTICES * 2, cover: 0.3, into: mask }, vertex => placed(vertex, 0, 0), () => vec4(0, 1, 0, 1))
const lines = shapes({ count: LINE_VERTICES * 2, cover: 0.3, into: mask }, vertex => placed(vertex, 0, 1), () => vec4(0, 1, 1, 1))

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
    lines,
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
      // water six points to each side, it is a glint, and each fades in and out on its own eleven-second clock. Both
      // sides, or water beside a glint would take the glint's color and the glint would seem to hop.
      const left = scene.sample(vec2(spot - vec2(6, 0) / size)).rgb
      const right = scene.sample(vec2(spot + vec2(6, 0) / size)).rgb
      const beside = vec3((left + right) * 0.5)
      const glint = smoothstep(0.01, 0.05, min(length(here - left), length(here - right)))
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
      // The line art is a shade the other way from the shark, as look.ts makes it (LINE_CONTRAST).
      color = mix(color, shade(linear, l, 1.25, 1 - isDark), shark.z)
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
