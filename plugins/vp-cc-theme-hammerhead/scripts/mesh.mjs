// Writes the shark's triangles into hooks/sea.ts from the paths in hooks/scene.ts, so the GPU sea and the SVG
// sea draw one shark. A shader reads nothing but its own file, so the mesh is written into it: the points, as
// [x, y] rows, and the triangles, as rows of three point numbers, each in tables of 256 rows at most. Run it after changing a path: node scripts/mesh.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const here = new URL('../hooks/', import.meta.url)
const scene = readFileSync(new URL('scene.ts', here), 'utf8')
/** The longest piece of a curve, in the shark's own units. */
const PIECE = 14

const part = name => {
  const found = scene.match(new RegExp(`const ${name}: Part = \\[([\\s\\S]*?)\\]\\n`))
  if (!found) throw new Error(`No part named ${name} in scene.ts`)

  return [...found[1].matchAll(/'([^']+)'/g)].map(match => match[1])
}
const fins = [...scene.matchAll(/d: '([^']+)'/g)].map(match => match[1])
// The part numbers the shader hinges on: 0 body, 1 head, 2 middle, 3 rear, 4 stalk, 5 and 6 the tail's upper and
// lower lobes, 7 and 8 the left and right pectorals.
const paths = [['BODY', 0], ['HEAD', 1], ['MIDDLE', 2], ['REAR', 3], ['STALK', 4], ['UPPER_LOBE', 5], ['LOWER_LOBE', 6]]
  .flatMap(([name, id]) => part(name).map(d => [d, id]))
  .concat([[fins[0], 7], [fins[1], 8]])

/** The outline of one path (M, L, C and Z only), each curve cut into pieces no longer than PIECE. */
function outline(d) {
  const tokens = d.match(/[MCLZ]|-?[\d.]+/g)
  const points = []
  let at = 0
  let pen = [0, 0]
  const next = () => +tokens[at++]
  while (at < tokens.length) {
    const command = tokens[at++]
    if (command === 'M' || command === 'L') {
      pen = [next(), next()]
      points.push(pen)
    } else if (command === 'C') {
      const a = [next(), next()]
      const b = [next(), next()]
      const end = [next(), next()]
      const reach = Math.hypot(a[0] - pen[0], a[1] - pen[1]) + Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(end[0] - b[0], end[1] - b[1])
      const pieces = Math.max(1, Math.min(8, Math.ceil(reach / PIECE)))
      for (let k = 1; k <= pieces; k++) {
        const s = k / pieces
        const u = 1 - s
        points.push([0, 1].map(i => u * u * u * pen[i] + 3 * u * u * s * a[i] + 3 * u * s * s * b[i] + s * s * s * end[i]))
      }
      pen = end
    }
  }
  const [first, last] = [points[0], points[points.length - 1]]
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) points.pop()

  return points
}

const area = poly => poly.reduce((sum, a, k) => {
  const b = poly[(k + 1) % poly.length]

  return sum + a[0] * b[1] - b[0] * a[1]
}, 0) / 2

/** Ear clipping: the polygon as triangles. */
function triangles(poly) {
  const isCounter = area(poly) > 0
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const isConvex = (a, b, c) => (isCounter ? cross(a, b, c) > 1e-9 : cross(a, b, c) < -1e-9)
  const isInside = (q, a, b, c) => {
    const [d1, d2, d3] = [cross(a, b, q), cross(b, c, q), cross(c, a, q)]

    return isCounter ? d1 >= 0 && d2 >= 0 && d3 >= 0 : d1 <= 0 && d2 <= 0 && d3 <= 0
  }
  const left = poly.map((_, k) => k)
  const out = []
  while (left.length > 3) {
    let isCut = false
    for (let k = 0; k < left.length; k++) {
      const [ia, ib, ic] = [left[(k + left.length - 1) % left.length], left[k], left[(k + 1) % left.length]]
      const [a, b, c] = [poly[ia], poly[ib], poly[ic]]
      if (!isConvex(a, b, c)) continue
      if (left.some(j => j !== ia && j !== ib && j !== ic && isInside(poly[j], a, b, c))) continue
      out.push([a, b, c])
      left.splice(k, 1)
      isCut = true
      break
    }
    // Only a point on a straight line is left uncut: it adds no area.
    if (!isCut) left.splice(0, 1)
  }
  out.push(left.map(j => poly[j]))

  return out
}

/** The polygon's part between two upright lines, `from` < x <= `to` (Sutherland-Hodgman, one side at a time). */
function slab(poly, from, to) {
  const clip = (points, isIn, cross) => {
    const out = []
    for (let k = 0; k < points.length; k++) {
      const a = points[k]
      const b = points[(k + 1) % points.length]
      if (isIn(a)) out.push(a)
      if (isIn(a) !== isIn(b)) out.push(cross(a, b))
    }

    return out
  }
  const at = x => (a, b) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])]

  const cut = clip(clip(poly, q => q[0] >= from, at(from)), q => q[0] <= to, at(to))
  // A cut can land on a point the polygon has, or on a straight run: drop repeats and points on a line between
  // their neighbors, which give ear clipping nothing to cut.
  const kept = cut.filter((q, k) => {
    const next = cut[(k + 1) % cut.length]

    return Math.hypot(q[0] - next[0], q[1] - next[1]) > 1e-6
  })

  return kept.filter((q, k) => {
    const a = kept[(k + kept.length - 1) % kept.length]
    const b = kept[(k + 1) % kept.length]

    return Math.abs((q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0])) > 1e-6
  })
}

// The trunk and tail bend along the route, so they are cut into upright slices every SLICE units: a straight edge
// longer than that would cut across the bend. The head and the pectorals are rigid and stay whole.
const SLICE = 18
const BENDS = new Set([0, 2, 3, 4, 5, 6])

// Each part keeps points of its own, in part order, so a point's part is told by where its number falls.
const points = []
const tris = []
const starts = []
for (const id of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
  starts.push(points.length)
  const seen = new Map()
  const index = ([x, y]) => {
    const key = `${Math.round(x)},${Math.round(y)}`
    if (!seen.has(key)) {
      seen.set(key, points.length)
      points.push([Math.round(x), Math.round(y)])
    }

    return seen.get(key)
  }
  for (const [d] of paths.filter(([, of]) => of === id)) {
    const poly = outline(d)
    const xs = poly.map(q => q[0])
    const pieces = []
    if (BENDS.has(id)) {
      for (let x = Math.floor(Math.min(...xs) / SLICE) * SLICE; x < Math.max(...xs); x += SLICE) {
        const piece = slab(poly, x, x + SLICE)
        if (piece.length >= 3 && Math.abs(area(piece)) > 0.5) pieces.push(piece)
      }
    } else {
      pieces.push(poly)
    }
    const cut = pieces.flatMap(triangles)
    const lost = Math.abs(Math.abs(area(poly)) - cut.reduce((sum, t) => sum + Math.abs(area(t)), 0))
    if (lost > 2) throw new Error(`Part ${id} lost ${lost.toFixed(0)} of its area in triangles`)
    for (const triangle of cut) {
      const corners = triangle.map(index)
      if (new Set(corners).size === 3) tris.push(corners)
    }
  }
}
if (points.length > 512 || tris.length > 512) throw new Error(`${points.length} points and ${tris.length} triangles do not fit in two tables each`)
// A table needs a row, so an unused second table holds one row of zeros.
const rows = (list, from, to) => list.slice(from, to).map(row => `[${row.join(', ')}]`).join(', ') || `[${list[0].map(() => 0).join(', ')}]`
const mesh = `// mesh:start (written by scripts/mesh.mjs)
const VERTICES = ${tris.length * 3}
const POINTS_A = table([${rows(points, 0, 256)}])
const POINTS_B = table([${rows(points, 256, 512)}])
const TRIS_A = table([${rows(tris, 0, 256)}], 'int')
const TRIS_B = table([${rows(tris, 256, 512)}], 'int')
/** The part a point belongs to: 0 body, 1 head, 2 middle, 3 rear, 4 stalk, 5 and 6 the tail's lobes, 7 and 8 the pectorals. */
function partOf(index: number): number {
  return ${starts.slice(1).map(start => `step(${start - 0.5}, index)`).join(' + ')}
}
// mesh:end`
const target = new URL('sea.ts', here)
const sea = readFileSync(target, 'utf8')
const written = sea.replace(/\/\/ mesh:start[\s\S]*?\/\/ mesh:end/, mesh)
if (written === sea && !sea.includes(mesh)) throw new Error('hooks/sea.ts has no mesh:start and mesh:end markers')
writeFileSync(target, written)
console.log(`${points.length} points, ${tris.length} triangles`)
