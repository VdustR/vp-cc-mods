// Color arithmetic for six-digit hex colors: WCAG contrast, mixing in sRGB, and lightness, chroma and hue in OKLCH.

type Rgb = [number, number, number]

/** Lightness 0 to 1, chroma, and hue in radians. */
export type Lch = [number, number, number]

function channels(color: string): Rgb {
  return [1, 3, 5].map(at => Number.parseInt(color.slice(at, at + 2), 16)) as Rgb
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`
}

function linear(value: number): number {
  const v = value / 255

  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function gamma(value: number): number {
  return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)
}

/** Whether the text is a six-digit hex color. */
export function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

/** WCAG relative luminance, 0 to 1. */
export function luminance(color: string): number {
  const [r, g, b] = channels(color).map(linear) as Rgb

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]

  return (high + 0.05) / (low + 0.05)
}

/** `from` with `amount` of `to` over it, 0 to 1: what a layer of that opacity draws. */
export function mix(from: string, to: string, amount: number): string {
  const a = channels(from)
  const b = channels(to)

  return toHex(a.map((value, at) => value + (b[at]! - value) * amount))
}

export function toLch(color: string): Lch {
  const [r, g, b] = channels(color).map(linear) as Rgb
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return [lightness, Math.hypot(a, bb), Math.atan2(bb, a)]
}

/** The nearest color sRGB can show: the chroma shrinks until it fits. */
export function fromLch([lightness, chroma, hue]: Lch): string {
  const l0 = Math.max(0, Math.min(1, lightness))
  for (let c = chroma; ; c *= 0.94) {
    const a = c * Math.cos(hue)
    const b = c * Math.sin(hue)
    const l = (l0 + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (l0 - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (l0 - 0.0894841775 * a - 1.291485548 * b) ** 3
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
    if (c < 0.002 || rgb.every(value => value >= -0.0005 && value <= 1.0005)) {
      return toHex(rgb.map(value => gamma(Math.max(0, Math.min(1, value)))))
    }
  }
}

/** `color` moved toward `end` only as far as it takes to reach `target` contrast on `ground`. */
export function pushTo(color: string, ground: string, target: number, end: string): string {
  let out = color
  for (let amount = 0.02; amount <= 1 && contrast(out, ground) < target; amount += 0.02) {
    out = mix(color, end, amount)
  }

  return out
}

/** The opacity of a `layer` over `ground` that draws `target` contrast against the bare ground, capped at `most`. */
export function opacityFor(ground: string, layer: string, target: number, most: number): number {
  if (contrast(mix(ground, layer, most), ground) <= target) return most
  let low = 0
  let high = most
  for (let step = 0; step < 14; step++) {
    const middle = (low + high) / 2
    if (contrast(mix(ground, layer, middle), ground) < target) low = middle
    else high = middle
  }

  return +high.toFixed(3)
}
