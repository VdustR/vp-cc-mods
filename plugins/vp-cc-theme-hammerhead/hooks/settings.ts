// What a person can choose, with its defaults and its limits.

import type { LookSettings, Mode, Scheme } from '../types'
import { modeOf } from './look'
import { DEFAULTS, PRESETS } from './presets'
import { ANSI_KEYS } from './scheme'
import { isHex } from './color'

export const DEFAULT_LOOK: LookSettings = {
  dark: DEFAULTS.dark,
  light: DEFAULTS.light,
  blur: 4,
  veil: 40,
  size: 100,
  speed: 100,
  isSharkShown: true,
  backdrop: 'moving',
  depth: 3,
  waves: 5,
  waveSpeed: 100,
  glints: 22,
  sharkTone: 4,
  isHighContrast: false,
  custom: [],
}

/** The numbers of glints a person can choose, fewest first. */
export const GLINTS: readonly number[] = [0, 10, 22, 40]

export const BLUR_STEP = 2
export const BLUR_MOST = 24
export const VEIL_STEP = 10
export const VEIL_MOST = 80

/** What the four glass levels of earlier versions stored, as the blur and veil they stood for. */
const OLD_GLASS: Record<string, { blur: number; veil: number }> = {
  off: { blur: 0, veil: 0 },
  clear: { blur: 2, veil: 20 },
  standard: { blur: 4, veil: 40 },
  frosted: { blur: 8, veil: 50 },
}

/**
 * The frost over the sea, as `$.theme.set` takes it: `false` when there is neither blur nor veil. No tint: a tint
 * is one raw color for both modes, so it could not follow light and dark, and the panels' own color does.
 */
export function glassOf(settings: LookSettings): { blur: number; opacity: number } | false {
  return settings.blur === 0 && settings.veil === 0 ? false : { blur: settings.blur, opacity: settings.veil / 100 }
}

function stepped(value: unknown, step: number, most: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(most, Math.round(value / step) * step)) : fallback
}

export const STEP = 25
export const LEAST = 50
export const MOST = 200

/** At most this many schemes of a person's own are kept: the oldest goes first. */
export const CUSTOM_LIMIT = 24

function percent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(LEAST, Math.min(MOST, Math.round(value / STEP) * STEP)) : 100
}

function isScheme(value: unknown): value is Scheme {
  if (typeof value !== 'object' || value === null) return false
  const scheme = value as Record<string, unknown>

  return (
    typeof scheme.name === 'string' &&
    [...ANSI_KEYS, 'background', 'foreground', 'cursorColor', 'selectionBackground'].every(key => isHex(scheme[key]))
  )
}

/** Every scheme a mode can draw: the shipped ones, then the person's own. */
export function schemesFor(settings: LookSettings, mode: Mode): Scheme[] {
  return [...PRESETS, ...settings.custom].filter(scheme => modeOf(scheme) === mode)
}

/** The scheme a mode draws: the chosen one, or the default when the choice is gone or belongs to the other mode. */
export function schemeOf(settings: LookSettings, mode: Mode): Scheme {
  const all = schemesFor(settings, mode)

  return all.find(scheme => scheme.name === settings[mode]) ?? all.find(scheme => scheme.name === DEFAULTS[mode])!
}

/** LookSettings read back from the store, where anything may have been written: each part is checked on its own. */
export function readSettings(raw: unknown): LookSettings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const custom = Array.isArray(stored.custom) ? stored.custom.filter(isScheme).slice(-CUSTOM_LIMIT) : []
  // Settings saved before blur and veil were set apart hold one of four glass levels.
  const old = OLD_GLASS[typeof stored.glass === 'string' ? stored.glass : 'standard'] ?? OLD_GLASS.standard!
  const settings: LookSettings = {
    dark: typeof stored.dark === 'string' ? stored.dark : DEFAULTS.dark,
    light: typeof stored.light === 'string' ? stored.light : DEFAULTS.light,
    blur: stepped(stored.blur, BLUR_STEP, BLUR_MOST, old.blur),
    veil: stepped(stored.veil, VEIL_STEP, VEIL_MOST, old.veil),
    size: percent(stored.size),
    speed: percent(stored.speed),
    isSharkShown: stored.isSharkShown !== false,
    backdrop: stored.backdrop === 'still' || stored.backdrop === 'plain' ? stored.backdrop : 'moving',
    depth: typeof stored.depth === 'number' && Number.isInteger(stored.depth) && stored.depth >= 1 && stored.depth <= 10 ? stored.depth : 3,
    waves: stored.waves === 3 || stored.waves === 7 ? stored.waves : 5,
    waveSpeed: percent(stored.waveSpeed),
    // Earlier versions kept the glints as on or off.
    glints: GLINTS.includes(stored.glints as number) ? (stored.glints as number) : stored.hasGlints === false ? 0 : 22,
    sharkTone: typeof stored.sharkTone === 'number' && Number.isInteger(stored.sharkTone) && stored.sharkTone >= 1 && stored.sharkTone <= 10 ? stored.sharkTone : 4,
    isHighContrast: stored.isHighContrast === true,
    custom,
  }

  return { ...settings, dark: schemeOf(settings, 'dark').name, light: schemeOf(settings, 'light').name }
}

/** The settings with a scheme of the person's own added, replacing one of the same name, and chosen for its mode. */
export function withCustom(settings: LookSettings, scheme: Scheme): LookSettings {
  // A shipped name stays the shipped scheme's: the person's copy is told apart.
  const name = PRESETS.some(preset => preset.name === scheme.name) ? `${scheme.name} (mine)` : scheme.name
  const named = { ...scheme, name }
  const custom = [...settings.custom.filter(one => one.name !== name), named].slice(-CUSTOM_LIMIT)

  return modeOf(named) === 'dark' ? { ...settings, custom, dark: name } : { ...settings, custom, light: name }
}
