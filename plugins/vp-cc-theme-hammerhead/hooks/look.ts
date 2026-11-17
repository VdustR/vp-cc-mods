// From a scheme to a look: the app's colors and the sea's, by one set of rules for every scheme.
//
// A terminal scheme says nothing of cards, muted text or water, so each is worked out from its background,
// foreground and 16 colors, to fixed contrast targets, not fixed colors: a scheme with a pale background and one
// with a black one end with ribbons, a shark and words that stand out equally.

import type { ThemeColors } from 'claude-code'

import { contrast, fromLch, luminance, mix, opacityFor, pushTo, toLch } from './color'
import { makeColors } from './make-colors.js'
import type { Accent, Scheme } from '../types'

export type Mode = 'dark' | 'light'

/** The colors of the sea, for the scene's style sheet. */
export type Sea = {
  deep: string
  mid: string
  shallow: string
  glow: string
  /** The ribbons, drawn at `bandOpacity`, and their crest lines at `crestOpacity`. */
  light: string
  bandOpacity: number
  crestOpacity: number
  shark: string
  sharkOpacity: number
  shadow: string
  shadowOpacity: number
  speck: string
  speckOpacity: number
}

type Role = 'accent' | 'danger' | 'success' | 'warning' | 'pro'

type Anchors = { 'surface-0': string; 'text-primary': string } & Partial<
  Record<'surface-1' | 'surface-2' | 'surface-3' | 'text-secondary' | 'text-muted', string>
>

type Half = { gray: { anchors: Anchors }; roles?: Partial<Record<Role, string>>; git?: Record<string, string> }

// How much a ribbon, its crest and the shark stand out from the water, as contrast ratios. Measured from the
// hand-tuned Gruvbox night sea and Everforest lagoon this plugin started with.
/** The contrast between the water and the shark at a tone level, 1 (faint) to 10 (bold). Level 4 is 2.4. */
export function sharkContrast(tone: number): number {
  return 1.2 + Math.max(1, Math.min(10, tone)) * 0.3
}

/** A scheme belongs to the mode its background is in. */
export function modeOf(scheme: Scheme): Mode {
  return luminance(scheme.background) > 0.18 ? 'light' : 'dark'
}

/**
 * The stronger of a color and its bright twin against the background. In a light scheme the "bright" color is
 * often the darker, stronger one, and in some schemes (Solarized) the bright slots hold grays, so the twin only
 * counts when it is the same hue.
 */
function stronger(scheme: Scheme, normal: string, bright: string): string {
  const [, chroma, hue] = toLch(normal)
  const [, twinChroma, twinHue] = toLch(bright)
  const turn = Math.abs(Math.atan2(Math.sin(hue - twinHue), Math.cos(hue - twinHue)))
  const isTwin = twinChroma > 0.04 && (chroma <= 0.04 || turn < 0.7)

  return isTwin && contrast(bright, scheme.background) > contrast(normal, scheme.background) ? bright : normal
}

/**
 * The background at another lightness: the same hue and chroma in OKLCH, moved lighter or darker until it reaches
 * `target` contrast against the background itself. Mixing in the foreground instead grays a warm background, since
 * a scheme's text is rarely its background's hue, and the water then looks dirty.
 */
function shade(background: string, target: number, isLighter: boolean): string {
  const [lightness, chroma, hue] = toLch(background)
  let out = background
  for (let step = 0.005; step <= 1 && contrast(out, background) < target; step += 0.005) {
    out = fromLch([lightness + (isLighter ? step : -step), chroma, hue])
  }

  return out
}

/** The contrast between the water and its ribbons at a depth level, 1 (barely there) to 10 (deep). */
export function depthContrast(depth: number): number {
  return 1 + Math.max(1, Math.min(10, depth)) * 0.1
}

/**
 * The sea under a scheme, at a depth level.
 *
 * The ribbons are always the lighter of the two, as light on water is, and `depth` sets how far apart they are.
 * On a dark scheme the water is the background, level with the app's panels, and the ribbons are a lighter shade
 * of it. A light scheme has no room above its background, so there the ribbons are the background and the water
 * is a darker shade of it. The shark is a shade further from the water: paler on a dark scheme, darker on a light
 * one.
 */
export function seaOf(scheme: Scheme, depth: number, sharkTone = 4): Sea {
  const isDark = modeOf(scheme) === 'dark'
  const { background } = scheme
  const step = depthContrast(depth)
  const water = isDark ? background : shade(background, step, false)
  const ribbon = isDark ? shade(background, step, true) : background
  const shark = shade(water, sharkContrast(sharkTone), isDark)
  const glint = stronger(scheme, scheme.yellow, scheme.brightYellow)
  const hasGlint = contrast(glint, water) >= 3
  // A shadow is darker than the water on either kind of scheme; on water already near black it is black.
  const dim = shade(water, 1.5, false)

  return {
    deep: water,
    mid: water,
    shallow: water,
    glow: mix(water, ribbon, 0.3),
    light: ribbon,
    // A ribbon's body is half as strong as its crest line.
    bandOpacity: opacityFor(water, ribbon, 1 + (step - 1) * 0.5, 0.9),
    crestOpacity: 1,
    shark,
    sharkOpacity: 1,
    shadow: contrast(dim, water) >= 1.3 ? dim : '#000000',
    shadowOpacity: isDark ? 0.5 : 0.35,
    speck: hasGlint ? glint : ribbon,
    speckOpacity: hasGlint ? 0.5 : 0.9,
  }
}

/** What a person set that the colors depend on. */
export type Tuning = {
  /** The sea's depth, which moves the ground text is read on. */
  depth: number
  /** How far the surfaces step apart, 0 to 6, where 2 is the plugin's own. */
  layers: number
  accent: Accent
}

/**
 * The app's colors for one mode, as the design system's color builder takes them. `lift` eases the surface steps
 * for a scheme the app would not paint otherwise; it scales what `tuning.layers` asks for.
 */
function halfOf(scheme: Scheme, lift: number, dropped: ReadonlySet<Role>, tuning: Tuning): Half {
  const isDark = modeOf(scheme) === 'dark'
  const { background, foreground } = scheme
  const far = isDark ? '#ffffff' : '#000000'
  // The page is the background. Cards, panels and menus step away from it by a fixed, small amount: toward the
  // foreground in dark mode, toward white in light mode, where the design system wants cards lighter than the page.
  const steps = (isDark ? [0.02, 0.04, 0.05] : [0.35, 0.7, 0.7]).map(amount => mix(background, isDark ? foreground : '#ffffff', Math.min(1, amount * lift * (tuning.layers / 2))))
  // Words are read on the page, on cards and straight on the sea, under a ribbon too: hold them to the worst.
  const sea = seaOf(scheme, tuning.depth)
  // The last ground stands for a filled control on a menu, the lightest thing dim text sits on in the app.
  const grounds = [background, steps[2]!, sea.mid, mix(sea.mid, sea.light, sea.bandOpacity), mix(steps[2]!, foreground, 0.1)]
  const worst = (text: string): string => grounds.reduce((low, ground) => (contrast(text, ground) < contrast(text, low) ? ground : low))
  const reach = (text: string, target: number): string => {
    let out = text
    for (let round = 0; round < 4; round++) out = pushTo(out, worst(out), target, far)

    return out
  }
  const primary = reach(foreground, 7)
  const anchors: Anchors = {
    'surface-0': background,
    'surface-1': steps[0]!,
    'surface-2': steps[1]!,
    'surface-3': steps[2]!,
    'text-primary': primary,
    'text-secondary': reach(mix(primary, background, 0.22), 5.5),
    'text-muted': reach(mix(primary, background, 0.42), 4.6),
  }
  const cursor = toLch(scheme.cursorColor)
  const blue = stronger(scheme, scheme.blue, scheme.brightBlue)
  const all: Record<Role, string> = {
    accent:
      tuning.accent === 'scheme'
        ? (scheme.accent ?? (cursor[1] > 0.08 && scheme.cursorColor !== foreground ? scheme.cursorColor : blue))
        : stronger(scheme, scheme[tuning.accent], scheme[BRIGHT[tuning.accent]]),
    danger: stronger(scheme, scheme.red, scheme.brightRed),
    success: stronger(scheme, scheme.green, scheme.brightGreen),
    warning: stronger(scheme, scheme.yellow, scheme.brightYellow),
    pro: stronger(scheme, scheme.purple, scheme.brightPurple),
  }
  const roles: Partial<Record<Role, string>> = {}
  for (const role of Object.keys(all) as Role[]) {
    if (!dropped.has(role)) roles[role] = all[role]
  }

  return {
    gray: { anchors },
    roles,
    git: {
      added: all.success,
      removed: all.danger,
      modified: blue,
      merged: all.pro,
      closed: all.danger,
      conflicting: all.warning,
      draft: anchors['text-muted']!,
    },
  }
}

/** Each of the six colors' bright twin in a scheme. */
const BRIGHT = { red: 'brightRed', yellow: 'brightYellow', green: 'brightGreen', cyan: 'brightCyan', blue: 'brightBlue', purple: 'brightPurple' } as const

const ROLES: readonly Role[] = ['accent', 'danger', 'success', 'warning', 'pro']

function blocker(problems: readonly string[]): string | undefined {
  return problems.find(line => line.startsWith("Desktop won't paint"))
}

/**
 * One mode's colors that the Desktop app will paint. The app ignores a whole theme when one piece of text falls
 * under its floor, so a scheme that fails is eased until it passes: flatter surfaces first, then the one role
 * color the complaint names is left to the app's own, then all of them.
 */
function paintable(scheme: Scheme, tuning: Tuning): Half {
  const mode = modeOf(scheme)
  const tryOne = (half: Half): string | undefined => {
    try {
      return blocker(makeColors({ label: 'check', only: mode, [mode]: half }).problems)
    } catch (error) {
      return String(error)
    }
  }
  const dropped = new Set<Role>()
  for (const lift of [1, 0.5, 0]) {
    const half = halfOf(scheme, lift, dropped, tuning)
    if (tryOne(half) === undefined) return half
  }
  for (let round = 0; round < ROLES.length; round++) {
    const half = halfOf(scheme, 0, dropped, tuning)
    const complaint = tryOne(half)
    if (complaint === undefined) return half
    const named = ROLES.find(role => !dropped.has(role) && complaint.includes(`-${role}`))
    dropped.add(named ?? ROLES.find(role => !dropped.has(role))!)
  }
  const bare = halfOf(scheme, 0, new Set(ROLES), tuning)
  if (tryOne(bare) === undefined) return bare

  return { gray: { anchors: { 'surface-0': bare.gray.anchors['surface-0'], 'text-primary': bare.gray.anchors['text-primary'] } } }
}

/** The app's colors for a dark scheme and a light one. */
export function colorsOf(dark: Scheme, light: Scheme, tuning: Tuning, isHighContrast = false): ThemeColors {
  const codeTheme = {
    ...(dark.codeTheme === undefined ? {} : { dark: dark.codeTheme }),
    ...(light.codeTheme === undefined ? {} : { light: light.codeTheme }),
  }

  return makeColors({
    label: `${dark.name} / ${light.name}`.slice(0, 64),
    id: 'vp-cc-theme-hammerhead',
    dark: paintable(dark, tuning),
    light: paintable(light, tuning),
    ...(Object.keys(codeTheme).length === 0 ? {} : { codeTheme }),
    ...(isHighContrast ? { contrast: 'more' as const } : {}),
  }).theme
}

/** Whether the Desktop app paints these colors: for a test, and to tell a person their scheme was eased. */
export function isPainted(dark: Scheme, light: Scheme, tuning: Tuning): boolean {
  return blocker(makeColors({ label: 'check', dark: paintable(dark, tuning), light: paintable(light, tuning) }).problems) === undefined
}
