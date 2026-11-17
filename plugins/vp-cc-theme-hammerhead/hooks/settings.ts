// What a person can choose, with its defaults and its limits.

import type { Glass, LookSettings, Mode, Scheme } from '../types'
import { modeOf } from './look'
import { DEFAULTS, PRESETS } from './presets'
import { ANSI_KEYS } from './scheme'
import { isHex } from './color'

export const DEFAULT_LOOK: LookSettings = {
  dark: DEFAULTS.dark,
  light: DEFAULTS.light,
  glass: 'standard',
  size: 100,
  speed: 100,
  isSharkShown: true,
  backdrop: 'moving',
  waves: 5,
  hasGlints: true,
  isHighContrast: false,
  custom: [],
}

/** The frost over the sea, as `$.theme.set` takes it. No tint: the panels keep their own color, which follows the mode. */
export const GLASS: Record<Glass, { blur: number; opacity: number } | false> = {
  off: false,
  clear: { blur: 2, opacity: 0.22 },
  standard: { blur: 4, opacity: 0.4 },
  frosted: { blur: 8, opacity: 0.5 },
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
  const settings: LookSettings = {
    dark: typeof stored.dark === 'string' ? stored.dark : DEFAULTS.dark,
    light: typeof stored.light === 'string' ? stored.light : DEFAULTS.light,
    glass: stored.glass === 'off' || stored.glass === 'clear' || stored.glass === 'frosted' ? stored.glass : 'standard',
    size: percent(stored.size),
    speed: percent(stored.speed),
    isSharkShown: stored.isSharkShown !== false,
    backdrop: stored.backdrop === 'still' || stored.backdrop === 'plain' ? stored.backdrop : 'moving',
    waves: stored.waves === 3 || stored.waves === 7 ? stored.waves : 5,
    hasGlints: stored.hasGlints !== false,
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
