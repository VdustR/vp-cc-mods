// Writes the shark's triangles into hooks/sea.ts from the paths in hooks/scene.ts, so the GPU sea and the SVG
// sea draw one shark. A shader reads nothing but its own file, so the mesh is written into it: the points, as
// [x, y] rows, and the triangles, as rows of three point numbers, each in tables of 256 rows at most. The
// silhouette's triangles come first and the line art's after them, so the shader draws each in its own pass.
// The shark is symmetric, so only its right half (y >= 0) is kept, and the shader draws it twice, once mirrored:
// the whole shark would not fit in the shader's 16,384 bits of numbers.
//
//   node scripts/mesh.mjs           writes the mesh; run it after changing a path
//   node scripts/mesh.mjs --check   fails when hooks/sea.ts holds a mesh other than the paths give
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
const fins = [...scene.matchAll(/ d: '([^']+)'/g)].map(match => match[1])
const finLines = [...scene.matchAll(/ line: '([^']+)'/g)].map(match => match[1])
// The part numbers the shader hinges on: 0 body, 1 head, 2 middle, 3 rear, 4 stalk, 5 the tail's upper lobe, 6
// the right pectoral, which mirrored is the left, and 7 the tail's lower lobe.
const TRUNK = [['BODY', 0], ['HEAD', 1], ['MIDDLE', 2], ['REAR', 3], ['STALK', 4], ['UPPER_LOBE', 5], ['LOWER_LOBE', 7]]
const PARTS = [0, 1, 2, 3, 4, 5, 6, 7]
const paths = TRUNK.flatMap(([name, id]) => part(name).map(d => [d, id])).concat([[fins[1], 6]])
const linePaths = TRUNK.flatMap(([name, id]) => part(`${name}_LINES`).map(d => [d, id])).concat([[finLines[1], 6]])

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

/** The polygon's right half, y >= 0 (Sutherland-Hodgman against the axis), with repeated points dropped. */
function right(poly) {
  const out = []
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k]
    const b = poly[(k + 1) % poly.length]
    if (a[1] >= 0) out.push(a)
    if ((a[1] >= 0) !== (b[1] >= 0)) out.push([a[0] + ((b[0] - a[0]) * -a[1]) / (b[1] - a[1]), 0])
  }

  return out.filter((q, k) => {
    const next = out[(k + 1) % out.length]

    return Math.hypot(q[0] - next[0], q[1] - next[1]) > 1e-6
  })
}

// The trunk and tail bend along the route, so they are cut into upright slices every SLICE units: a straight edge
// longer than that would cut across the bend. The head and the pectorals are rigid and stay whole.
const SLICE = 30
const BENDS = new Set([0, 2, 3, 4, 5, 7])

// Each part keeps points of its own, in part order, so a point's part is told by where its number falls.
const points = []
const tris = []
const lineTris = []
const starts = []
for (const id of PARTS) {
  starts.push(points.length)
  const seen = new Map()
  // A point is kept to a whole unit, which costs the fewest bits; line art, one to three units wide, is kept to a
  // tenth, or rounding thins its lines to nothing and turns their edges jagged.
  const index = ([x, y], isLine) => {
    const keep = n => (isLine ? Math.round(n * 10) / 10 : Math.round(n))
    const key = `${keep(x)},${keep(y)}`
    if (!seen.has(key)) {
      seen.set(key, points.length)
      points.push([keep(x), keep(y)])
    }

    return seen.get(key)
  }
  for (const [d, , into] of [...paths.map(([d, of]) => [d, of, tris]), ...linePaths.map(([d, of]) => [d, of, lineTris])].filter(([, of]) => of === id)) {
    const poly = right(outline(d))
    if (poly.length < 3) continue
    const xs = poly.map(q => q[0])
    const pieces = []
    // Line art is not sliced: it is thin, so its triangles are many and small already, and each of its points
    // rides the spine on its own, so the lines bend with the body.
    if (BENDS.has(id) && into === tris) {
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
      const corners = triangle.map(corner => index(corner, into === lineTris))
      if (new Set(corners).size === 3) into.push(corners)
    }
  }
}
const all = [...tris, ...lineTris]
if (points.length > 512 || all.length > 512) throw new Error(`${points.length} points and ${all.length} triangles do not fit in two tables each`)
// A table needs a row, so an unused second table holds one row of zeros.
const rows = (list, from, to) => list.slice(from, to).map(row => `[${row.join(', ')}]`).join(', ') || `[${list[0].map(() => 0).join(', ')}]`
const mesh = `// mesh:start (written by scripts/mesh.mjs)
const VERTICES = ${tris.length * 3}
const LINE_VERTICES = ${lineTris.length * 3}
const POINTS_A = table([${rows(points, 0, 256)}])
const POINTS_B = table([${rows(points, 256, 512)}])
const TRIS_A = table([${rows(all, 0, 256)}], 'int')
const TRIS_B = table([${rows(all, 256, 512)}], 'int')
/** The part a point belongs to: 0 body, 1 head, 2 middle, 3 rear, 4 stalk, 5 the tail's upper lobe, 6 the pectoral, 7 the lower lobe. */
function partOf(index: number): number {
  return ${starts.slice(1).map(start => `step(${start - 0.5}, index)`).join(' + ')}
}
// mesh:end`
const target = new URL('sea.ts', here)
const sea = readFileSync(target, 'utf8')
const written = sea.replace(/\/\/ mesh:start[\s\S]*?\/\/ mesh:end/, mesh)
if (!/\/\/ mesh:start[\s\S]*?\/\/ mesh:end/.test(sea)) throw new Error('hooks/sea.ts has no mesh:start and mesh:end markers')
if (process.argv.includes('--check')) {
  if (written !== sea) {
    console.error('hooks/sea.ts holds a shark mesh other than the paths in hooks/scene.ts give: run node scripts/mesh.mjs')
    process.exit(1)
  }
  console.log(`The shark mesh matches hooks/scene.ts: ${points.length} points, ${tris.length} + ${lineTris.length} triangles`)
} else {
  writeFileSync(target, written)
  console.log(`${points.length} points, ${tris.length} + ${lineTris.length} triangles`)
}
