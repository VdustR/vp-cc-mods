import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { COLORS } from './colors'
import { buildScene } from './scene'

const PLUGIN = 'vp-cc-theme-hammerhead'
const SCENE_ID = 'hammerhead-sea'

// One sea per load: drawn once here, not in the render hook, so a redraw never moves the shark.
// A reload or a new session draws another.
const SCENE = buildScene(Math.floor(Math.random() * 2147483646))

const LOOK: ThemeSetArgs = {
  colors: COLORS,
  // Light glass, so the sea shows through the panels. No tint: the panels keep their own color, which follows the mode.
  backdrop: { scene: SCENE_ID, glass: { blur: 4, opacity: 0.4 } },
}

// Whether this load has set the theme for the conversation on screen. A /clear ends the conversation without a
// new `session.start`, and the theme goes with it, so the next prompt sets it again.
let isApplied = false

/**
 * Sets the theme and never throws: a look must not cost the session its start or the person their prompt.
 * It says nothing where no surface draws a look (the terminal, an editor): there is nothing to fix there.
 */
async function apply($: EngineInterface): Promise<void> {
  try {
    await $.theme.set(LOOK)
    isApplied = true
  } catch {
    isApplied = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await apply($)

    return next(e)
  })

  on('session.end', ($, e, next) => {
    if (e.reason === 'clear') {
      isApplied = false
    }

    return next(e)
  })

  // Never waits and never fails: the prompt goes on at once, whatever becomes of the theme.
  on('prompt.submit', ($, e, next) => {
    if (!isApplied) {
      void apply($).catch(() => {})
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Every plugin's hook hears every backdrop: leave another plugin's scene alone.
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.plugin !== PLUGIN || e.props.scene !== SCENE_ID) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={SCENE} alt="A hammerhead silhouette cruising a calm sea, seen from above, under slow ribbons of light" />
  })
}
