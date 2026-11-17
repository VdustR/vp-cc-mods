// From a scheme to a look: the app's colors and the sea's, by one set of rules for every scheme.
//
// A terminal scheme says nothing of cards, muted text or water, so each is worked out from its background,
// foreground and 16 colors, to fixed contrast targets, not fixed colors: a scheme with a pale background and one
// with a black one end with ribbons, a shark and words that stand out equally.

import type { ThemeColors } from 'claude-code'

import { contrast, luminance, mix, opacityFor, pushTo, toLch } from './color'
import { makeColors } from './make-colors.js'
import type { Scheme } from '../types'

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
const BAND = 1.3
const CREST = 1.6
const SHARK = 2.4

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
 * The sea under a scheme, in the scheme's own colors.
 *
 * The water is the background. The ribbons and the shark are the foreground, so they are light on a dark scheme and
 * dark on a light one, as the words are. Only their opacity is worked out, to reach the same contrast on every scheme.
 */
export function seaOf(scheme: Scheme): Sea {
  const isDark = modeOf(scheme) === 'dark'
  const { background, foreground } = scheme
  const glint = stronger(scheme, scheme.yellow, scheme.brightYellow)
  const hasGlint = contrast(glint, background) >= 3
  // A shadow has to be darker than the water. On a light scheme the foreground is; on a dark one the scheme's black
  // is, unless the background is already that black.
  const shade = isDark ? scheme.black : foreground
  const shadow = contrast(shade, background) >= 1.3 && luminance(shade) < luminance(background) ? shade : '#000000'

  return {
    deep: background,
    mid: background,
    shallow: background,
    glow: mix(background, foreground, 0.1),
    light: foreground,
    bandOpacity: opacityFor(background, foreground, BAND, 0.9),
    crestOpacity: opacityFor(background, foreground, CREST, 1),
    shark: foreground,
    sharkOpacity: opacityFor(background, foreground, SHARK, 0.9),
    shadow,
    shadowOpacity: isDark ? 0.2 : 0.13,
    speck: hasGlint ? glint : foreground,
    speckOpacity: hasGlint ? 0.5 : 0.9,
  }
}

/** The app's colors for one mode, as the design system's color builder takes them. `lift` scales the surface steps. */
function halfOf(scheme: Scheme, lift: number, dropped: ReadonlySet<Role>): Half {
  const isDark = modeOf(scheme) === 'dark'
  const { background, foreground } = scheme
  const far = isDark ? '#ffffff' : '#000000'
  // The page is the background. Cards, panels and menus step away from it by a fixed, small amount: toward the
  // foreground in dark mode, toward white in light mode, where the design system wants cards lighter than the page.
  const steps = (isDark ? [0.02, 0.04, 0.05] : [0.35, 0.7, 0.7]).map(amount => mix(background, isDark ? foreground : '#ffffff', amount * lift))
  // Words are read on the page, on cards and straight on the sea, under a ribbon too: hold them to the worst.
  const sea = seaOf(scheme)
  const grounds = [background, steps[2]!, sea.mid, mix(sea.mid, sea.light, sea.bandOpacity)]
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
    accent: scheme.accent ?? (cursor[1] > 0.08 && scheme.cursorColor !== foreground ? scheme.cursorColor : blue),
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

const ROLES: readonly Role[] = ['accent', 'danger', 'success', 'warning', 'pro']

function blocker(problems: readonly string[]): string | undefined {
  return problems.find(line => line.startsWith("Desktop won't paint"))
}

/**
 * One mode's colors that the Desktop app will paint. The app ignores a whole theme when one piece of text falls
 * under its floor, so a scheme that fails is eased until it passes: flatter surfaces first, then the one role
 * color the complaint names is left to the app's own, then all of them.
 */
function paintable(scheme: Scheme): Half {
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
    const half = halfOf(scheme, lift, dropped)
    if (tryOne(half) === undefined) return half
  }
  for (let round = 0; round < ROLES.length; round++) {
    const half = halfOf(scheme, 0, dropped)
    const complaint = tryOne(half)
    if (complaint === undefined) return half
    const named = ROLES.find(role => !dropped.has(role) && complaint.includes(`-${role}`))
    dropped.add(named ?? ROLES.find(role => !dropped.has(role))!)
  }
  const bare = halfOf(scheme, 0, new Set(ROLES))
  if (tryOne(bare) === undefined) return bare

  return { gray: { anchors: { 'surface-0': bare.gray.anchors['surface-0'], 'text-primary': bare.gray.anchors['text-primary'] } } }
}

/** The app's colors for a dark scheme and a light one. */
export function colorsOf(dark: Scheme, light: Scheme, isHighContrast = false): ThemeColors {
  const codeTheme = {
    ...(dark.codeTheme === undefined ? {} : { dark: dark.codeTheme }),
    ...(light.codeTheme === undefined ? {} : { light: light.codeTheme }),
  }

  return makeColors({
    label: `${dark.name} / ${light.name}`.slice(0, 64),
    id: 'vp-cc-theme-hammerhead',
    dark: paintable(dark),
    light: paintable(light),
    ...(Object.keys(codeTheme).length === 0 ? {} : { codeTheme }),
    ...(isHighContrast ? { contrast: 'more' as const } : {}),
  }).theme
}

/** Whether the Desktop app paints these colors: for a test, and to tell a person their scheme was eased. */
export function isPainted(dark: Scheme, light: Scheme): boolean {
  return blocker(makeColors({ label: 'check', dark: paintable(dark), light: paintable(light) }).problems) === undefined
}
