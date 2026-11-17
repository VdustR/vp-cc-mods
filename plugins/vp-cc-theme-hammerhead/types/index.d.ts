/** The 16 colors of a terminal, by the names the Windows Terminal scheme format gives them. */
export type AnsiKey =
  | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'cyan' | 'white'
  | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow' | 'brightBlue' | 'brightPurple' | 'brightCyan' | 'brightWhite'

/**
 * A color scheme: the 20 colors of a terminal theme, in the Windows Terminal scheme format that
 * mbadolato/iTerm2-Color-Schemes publishes for every scheme it collects. Every color is six-digit hex.
 */
export type Scheme = Record<AnsiKey, string> & {
  name: string
  background: string
  foreground: string
  cursorColor: string
  selectionBackground: string
  /**
   * Not part of the terminal format: the color of buttons, links and switches. A terminal scheme has no such
   * color, so without it the cursor color is used when it is a color and not a gray, else blue.
   */
  accent?: string
  /**
   * Not part of the terminal format either: the name of the app's own code highlighting theme that goes with
   * this scheme, such as `dracula`. The app keeps its own for a name it does not offer.
   */
  codeTheme?: string
}

export type Mode = 'dark' | 'light'

/** Where the color of buttons, links and switches comes from: the scheme's own choice, or one of its six colors. */
export type Accent = 'scheme' | 'red' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple'

/** What is behind the conversation: the sea in motion, the sea at rest, or the scheme's plain background. */
export type Backdrop = 'moving' | 'still' | 'plain'

/** What a person chose. Kept in the plugin's store, so every session on the machine draws the same look. */
export type LookSettings = {
  /** The name of the scheme each mode draws: a shipped one, or one of `custom`. */
  dark: string
  light: string
  /** How far the sea blurs behind the conversation and its panels, in points: 0 to 24. */
  blur: number
  /** How opaque the app's own panel color lies over the sea, in percent: 0 to 80. A message bubble is a panel. */
  veil: number
  /** The shark's size and pace in percent of its own, 50 to 200. */
  size: number
  speed: number
  isSharkShown: boolean
  backdrop: Backdrop
  /** How far the water sits below the scheme's background, 1 (barely) to 10 (deep). */
  depth: number
  /** How many ribbons cross the water: 3, 5 or 7. */
  waves: number
  /** How fast the ribbons drift, in percent of their own pace, 50 to 200. */
  waveSpeed: number
  /** How many specks of light twinkle on the water: 0, 10, 22 or 40. */
  glints: number
  /** How far the shark stands out from the water, 1 (faint) to 10 (bold). */
  sharkTone: number
  /** How far cards, panels and menus step away from the page, 0 (flat) to 6. The default is 2. */
  layers: number
  accent: Accent
  /** Stronger borders and focus rings across the app. */
  isHighContrast: boolean
  /** Schemes the person pasted or asked the model for. */
  custom: Scheme[]
}

/** What the settings pane shows beside the settings themselves. */
export type Panel = {
  /** The mode whose scheme is being chosen. */
  slot: Mode
  /** One line about the last action: what was saved, or what was wrong with a pasted scheme. */
  notice: string
  /** True while the model writes a scheme. */
  isBusy: boolean
  isJsonShown: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'vp-cc-theme-hammerhead': {
      settings: LookSettings
      panel: Panel
    }
  }
}
