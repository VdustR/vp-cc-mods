import { expect, test } from 'claude-code/testing'

import { contrast, mix } from '../hooks/color'
import { depthContrast, easingOf, isPainted, modeOf, seaOf } from '../hooks/look'
import { DEFAULTS, PRESETS } from '../hooks/presets'
import { parseScheme } from '../hooks/scheme'

const PLUGIN = 'vp-cc-theme-hammerhead'
const SCENE = 'hammerhead-sea'
const PANE = 'vp-cc-theme-hammerhead-settings'

type On = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1]
type Look = {
  colors?: { label?: string; inputs?: { light?: object; dark?: object } }
  backdrop?: { scene?: string; color?: string; glass?: { blur?: number; opacity?: number } | false }
}

const PROMPT = { origin: { kind: 'composer' }, wait: false } as const
const START = { cwd: '/tmp/project', surface: 'desktop', isInteractive: true } as const

// Stand in for the engine: record each theme the plugin sets, hold its store, and answer the model.
const engine = (on: On, reply = '') => {
  const looks: Look[] = []
  const store = new Map<string, unknown>()
  const asked: string[] = []
  on('theme.set', (_$, e) => {
    looks.push(e as Look)

    return { value: { isDrawn: true, requestId: 'r1' } }
  })
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))

    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('model.complete', (_$, e) => {
    asked.push(JSON.stringify(e))

    return { value: { isAnswered: true, text: reply, usage: { input_tokens: 0, output_tokens: 0 } } } as never
  })

  // Nothing sits beneath a test's hooks, so answer the events the tests raise.
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  return { looks, store, asked }
}

const backdrop = (plugin: string, scene: string) =>
  ({ component: 'Backdrop', props: { scene, plugin, glass: { blur: 4, opacity: 0.4 } } }) as const

// The pane takes no props of its own; the kit's type for a Pane's props asks for more than a mount needs.
const pane = (surface: 'terminal' | 'desktop') => ({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: {} }) as never

// The module environment has timers but declares none.
declare function setTimeout(callback: (value?: unknown) => void, milliseconds: number): unknown

// The prompt never waits for the theme, so a test gives the unawaited work a moment to finish.
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

// A scheme as iTerm2-Color-Schemes publishes one for Windows Terminal.
const PASTED = JSON.stringify({
  name: 'Ember',
  background: '#1b1412', foreground: '#f2e3d5', cursorColor: '#ff8a4c', selectionBackground: '#4a342c',
  black: '#1b1412', red: '#e5604d', green: '#9fb86a', yellow: '#e8b25c', blue: '#6fa3c7', purple: '#b98bc9', cyan: '#6fbfb2', white: '#d9c7b8',
  brightBlack: '#6b554b', brightRed: '#f27d6b', brightGreen: '#b7cf85', brightYellow: '#f4c97a', brightBlue: '#8dbbe0', brightPurple: '#cfa5dd', brightCyan: '#8fd6ca', brightWhite: '#fbf1e6',
})

test('the session starts with the default pair, one scheme a mode, and the sea as its backdrop', async ($, on) => {
  const { looks } = engine(on)

  await $.session.start(START)

  expect(looks.length).toBe(1)
  const look = looks[0]!
  expect(look.colors?.label).toBe(`${DEFAULTS.dark} / ${DEFAULTS.light}`)
  // Both halves are given, so the look follows the app's mode.
  expect(Object.keys(look.colors?.inputs?.dark ?? {}).length).toBeGreaterThan(0)
  expect(Object.keys(look.colors?.inputs?.light ?? {}).length).toBeGreaterThan(0)
  expect(look.backdrop?.scene).toContain(SCENE)
})

test('the backdrop is one script-free SVG that fits the limit and holds both modes', async ($, on) => {
  engine(on)
  await $.session.start(START)

  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, ...backdrop(PLUGIN, SCENE) })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg).toBeDefined()
    const tree = JSON.stringify(await ui.drawn())

    // The engine refuses an Svg past 131,072 characters, and then nothing is drawn.
    expect(tree.length).toBeLessThan(100_000)
    expect(tree).toContain('prefers-color-scheme: light')
    expect(tree).toContain('prefers-reduced-motion: reduce')
    expect(tree).not.toContain('<script')
    expect(tree).toContain('hammerhead')
    await ui.unmount()
  }
})

test('the desktop app plays the moving sea on the GPU over a still SVG, and the mobile app keeps the SVG that moves', async ($, on) => {
  engine(on)
  await $.session.start(START)

  const desktop = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...backdrop(PLUGIN, SCENE) })
  const shader = (await desktop.find({ type: 'Shader' })) as { props: { module: string; values: Record<string, number> } } | undefined
  expect(shader?.props.module).toBe('hooks/sea.ts')
  // A shader file declares eight values at most, each held to its range.
  expect(Object.keys(shader?.props.values ?? {}).sort()).toEqual(['depth', 'flow', 'kinds', 'rush', 'seed', 'size', 'speed', 'tone'])
  // The sea hurries only while Claude works on a turn.
  expect(shader?.props.values.rush).toBe(0)
  expect(shader?.props.values.seed).toBeLessThan(1024)
  const still = JSON.stringify(await desktop.drawn())
  // Under the shader nothing moves by itself, and the SVG's shark shows only where the app shows it alone.
  expect(still).toContain('animation: none !important')
  expect(still).toContain('class=\\"rest\\"')
  await desktop.unmount()

  const mobile = await $.ui.mount({ plugin: PLUGIN, surface: 'mobile', ...backdrop(PLUGIN, SCENE) })
  expect(await mobile.find({ type: 'Shader' })).toBeUndefined()
  const moving = JSON.stringify(await mobile.drawn())
  expect(moving).not.toContain('class=\\"rest\\"')
  expect(moving).toContain('@keyframes swim')
  await mobile.unmount()
})

test('a still sea draws no shader', async ($, on) => {
  const { store } = engine(on)
  store.set('settings', { backdrop: 'still' })
  await $.session.start(START)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...backdrop(PLUGIN, SCENE) })
  expect(await ui.find({ type: 'Shader' })).toBeUndefined()
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.unmount()
})

test("another plugin's backdrop is left alone", async ($, on) => {
  engine(on)
  await $.session.start(START)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...backdrop('some-other-theme', SCENE) })

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('after /clear the next prompt sets the theme again, and later prompts do not', async ($, on) => {
  const { looks } = engine(on)
  await $.session.start(START)
  expect(looks.length).toBe(1)

  await $.prompt.submit({ ...PROMPT, text: 'hello' })
  expect(looks.length).toBe(1)

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await $.prompt.submit({ ...PROMPT, text: 'hello again' })
  await settle()
  expect(looks.length).toBe(2)

  await $.prompt.submit({ ...PROMPT, text: 'and again' })
  await settle()
  expect(looks.length).toBe(2)
})

test('every shipped scheme is painted by the Desktop app and keeps its waves, its shark and its words clear', () => {
  const darks = PRESETS.filter(scheme => modeOf(scheme) === 'dark')
  const lights = PRESETS.filter(scheme => modeOf(scheme) === 'light')
  expect(darks.map(scheme => scheme.name)).toContain(DEFAULTS.dark)
  expect(lights.map(scheme => scheme.name)).toContain(DEFAULTS.light)

  for (const [at, scheme] of PRESETS.entries()) {
    const isDark = modeOf(scheme) === 'dark'
    // Flat and far-apart surfaces, and an accent taken from each end of the scheme's colors. Every third scheme is
    // enough to cover both modes, and keeps this test well inside its time on a busy machine.
    for (const tuning of at % 3 !== 0 ? [] : ([
      { depth: 3, layers: 0, accent: 'scheme', isCodeThemed: true },
      { depth: 3, layers: 6, accent: 'scheme', isCodeThemed: true },
      { depth: 3, layers: 2, accent: 'red', isCodeThemed: true },
      { depth: 3, layers: 2, accent: 'cyan', isCodeThemed: true },
    ] as const)) {
      expect(isPainted(isDark ? scheme : darks[0]!, isDark ? lights[0]! : scheme, tuning)).toBe(true)
    }
    // The shallowest, the default and the deepest sea: each depth moves the ground the text is read on.
    for (const depth of [1, 3, 10]) {
      // The Desktop app ignores a whole theme when one piece of text is under its floor.
      expect(isPainted(isDark ? scheme : darks[0]!, isDark ? lights[0]! : scheme, { depth, layers: 2, accent: 'scheme', isCodeThemed: true })).toBe(true)

      const sea = seaOf(scheme, depth, 1)
      const crest = mix(sea.mid, sea.light, sea.crestOpacity)
      const shark = mix(sea.mid, sea.shark, sea.sharkOpacity)
      // The same contrast on every scheme, pale or black: that is what keeps the waves visible.
      expect(contrast(crest, sea.mid)).toBeGreaterThan(1 + (depthContrast(depth) - 1) * 0.85)
      // Even the faintest shark stands clear of the water.
      expect(contrast(shark, sea.mid)).toBeGreaterThan(1.4)
      // The ribbons are the lighter of the two, in either mode.
      expect(contrast(sea.light, '#000000')).toBeGreaterThan(contrast(sea.mid, '#000000'))
    }
  }
})

test('a pasted scheme is read in the terminal format, and a broken one says what is wrong', () => {
  const scheme = parseScheme(PASTED, 'My scheme')
  expect(typeof scheme).toBe('object')
  expect(typeof scheme === 'object' && scheme.name).toBe('Ember')
  expect(typeof scheme === 'object' && scheme.cursorColor).toBe('#ff8a4c')

  // The nested form of term-ptt-custom-theme, with `cursor` and `selection`, and "magenta" for purple.
  const flat = JSON.parse(PASTED) as Record<string, string>
  const { background, foreground, cursorColor, selectionBackground, name, purple, brightPurple, ...ansi } = flat
  const nested = parseScheme(
    JSON.stringify({ name, scheme: { ...ansi, magenta: purple, brightMagenta: brightPurple }, metadata: { background, foreground, cursor: cursorColor, selection: selectionBackground } }),
    'My scheme',
  )
  expect(nested).toEqual(scheme)

  expect(parseScheme('not json', 'x')).toContain('not JSON')
  expect(parseScheme(JSON.stringify({ ...flat, green: 'green' }), 'x')).toContain('"green"')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the ${surface} pane chooses a scheme for each mode, keeps the choice, and draws it at once`, async ($, on) => {
    const { looks, store } = engine(on)
    await $.session.start({ ...START, surface })
    const ui = await $.ui.mount(pane(surface))

    // The pane opens on dark mode's schemes.
    expect(await ui.find({ type: 'Button', text: 'Catppuccin Mocha' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: 'Rose Pine Dawn' })).toBeUndefined()
    await ui.press({ key: 'hammerhead:pick-Catppuccin Mocha' })
    expect(looks.at(-1)?.colors?.label).toBe(`Catppuccin Mocha / ${DEFAULTS.light}`)

    await ui.press({ key: 'hammerhead:slot-light' })
    await ui.press({ key: 'hammerhead:pick-Rose Pine Dawn' })
    expect(looks.at(-1)?.colors?.label).toBe('Catppuccin Mocha / Rose Pine Dawn')
    expect(store.get('settings')).toMatchObject({ dark: 'Catppuccin Mocha', light: 'Rose Pine Dawn' })

    // The sea, the shark and the app start closed: each says in a line what it holds, and shows no control.
    expect(await ui.find({ type: 'Button', text: 'Blurrier' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /depth 3, 5 waves/ })).toBeDefined()
    await ui.press({ key: 'hammerhead:section-sea' })
    await ui.press({ key: 'hammerhead:section-shark' })
    await ui.press({ key: 'hammerhead:section-app' })
    expect(await ui.find({ type: 'Button', text: 'Blurrier' })).toBeDefined()
    // The pane is kept as it was left: the mode being chosen and the sections that are open.
    expect(store.get('pane')).toMatchObject({ slot: 'light', open: ['schemes', 'sea', 'shark', 'app'] })

    // Blur and veil are set apart: a sharp sea can sit under solid bubbles.
    await ui.press({ key: 'hammerhead:blur-down' })
    await ui.press({ key: 'hammerhead:veil-up' })
    expect(looks.at(-1)?.backdrop?.glass).toEqual({ blur: 2, opacity: 0.8 })

    await ui.press({ key: 'hammerhead:size-up' })
    await ui.press({ key: 'hammerhead:speed-down' })
    await ui.press({ key: 'hammerhead:shark' })
    expect(store.get('settings')).toMatchObject({ size: 125, speed: 75, isSharkShown: false })

    // Neither blur nor veil is no glass at all.
    for (let press = 0; press < 3; press++) await ui.press({ key: 'hammerhead:blur-down' })
    for (let press = 0; press < 8; press++) await ui.press({ key: 'hammerhead:veil-down' })
    expect(looks.at(-1)?.backdrop?.glass).toBe(false)
    await ui.press({ key: 'hammerhead:depth-up' })
    expect(store.get('settings')).toMatchObject({ depth: 4 })
    await ui.press({ key: 'hammerhead:waves-up' })
    await ui.press({ key: 'hammerhead:glints-down' })
    await ui.press({ key: 'hammerhead:wave-speed-up' })
    await ui.press({ key: 'hammerhead:shark-tone-up' })
    await ui.press({ key: 'hammerhead:layers-up' })
    await ui.press({ key: 'hammerhead:accent-cyan' })
    expect(store.get('settings')).toMatchObject({ layers: 3, accent: 'cyan' })
    // The scheme's code theme is named until the person turns it off, and then the app keeps its own.
    expect((looks.at(-1)?.colors as { codeTheme?: { dark?: string } } | undefined)?.codeTheme?.dark).toBe('catppuccin-mocha')
    await ui.press({ key: 'hammerhead:code-theme' })
    expect((looks.at(-1)?.colors as { codeTheme?: object } | undefined)?.codeTheme).toBeUndefined()
    await ui.press({ key: 'hammerhead:contrast' })
    expect(store.get('settings')).toMatchObject({ waves: 7, glints: 10, waveSpeed: 125, sharkTone: 5, isHighContrast: true })
    expect((looks.at(-1)?.colors as { contrast?: string } | undefined)?.contrast).toBe('more')

    // Still keeps the sea and rests it; plain swaps the sea for the page's own color, which takes no glass.
    await ui.press({ key: 'hammerhead:backdrop-still' })
    expect(looks.at(-1)?.backdrop?.scene).toContain(SCENE)
    // A surface draws the backdrop again only for a scene name it has not drawn, so every look names a new one.
    expect(looks.at(-1)?.backdrop?.scene).not.toBe(looks.at(-2)?.backdrop?.scene)
    await ui.press({ key: 'hammerhead:backdrop-plain' })
    expect(looks.at(-1)?.backdrop).toEqual({ color: 'surface-0' })

    await ui.press({ key: 'hammerhead:reset' })
    expect(looks.at(-1)?.colors?.label).toBe(`${DEFAULTS.dark} / ${DEFAULTS.light}`)
    await ui.unmount()
  })
}

// Published in iTerm2-Color-Schemes. Its gray foreground is readable on its background, and too dim on the app's
// own comment highlight, over which the app refuses the whole theme.
const DIM = JSON.stringify({
  name: '3024 Night',
  background: '#090300', foreground: '#a5a2a2', cursorColor: '#a5a2a2', selectionBackground: '#4a4543',
  black: '#090300', red: '#db2d20', green: '#01a252', yellow: '#fded02', blue: '#01a0e4', purple: '#a16a94', cyan: '#b5e4f4', white: '#a5a2a2',
  brightBlack: '#5c5855', brightRed: '#e8bbd0', brightGreen: '#47413f', brightYellow: '#4a4543', brightBlue: '#807d7c', brightPurple: '#d6d5d4', brightCyan: '#cdab53', brightWhite: '#f7f7f7',
})

// Also published there. Its background is a mid teal: too light for the app's dark mode and too dark for its light.
const MIDTONE = JSON.stringify({ ...(JSON.parse(DIM) as object), name: 'Agave Dusk', background: '#145654', foreground: '#fff0d8', cursorColor: '#f6bd59', selectionBackground: '#347371' })

test('a scheme the app would refuse is eased until it is painted, and one that cannot be is told apart', () => {
  const tuning = { depth: 3, layers: 2, accent: 'scheme', isCodeThemed: true } as const
  const light = PRESETS.find(scheme => scheme.name === DEFAULTS.light)!
  for (const scheme of PRESETS) expect(easingOf(scheme, tuning)).toEqual({ left: [], isFirmer: false, isPainted: true })

  // Dim text is made firmer, and the scheme keeps every color of its own.
  const dim = parseScheme(DIM, 'x')
  expect(typeof dim).toBe('object')
  if (typeof dim === 'object') {
    expect(easingOf(dim, tuning)).toEqual({ left: [], isFirmer: true, isPainted: true })
    expect(isPainted(dim, light, tuning)).toBe(true)
  }

  const midtone = parseScheme(MIDTONE, 'x')
  expect(typeof midtone === 'object' && easingOf(midtone, tuning).isPainted).toBe(false)
})

test('a change that leaves the sea alone keeps its name, a press at a limit draws nothing, and changes keep their order', async ($, on) => {
  const { looks, store } = engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))
  await ui.press({ key: 'hammerhead:section-sea' })
  await ui.press({ key: 'hammerhead:section-app' })
  const first = looks.at(-1)?.backdrop?.scene

  // An accent recolors the app and the sea is the same drawing: under the same name the shark swims on.
  await ui.press({ key: 'hammerhead:accent-cyan' })
  expect(looks.length).toBe(2)
  expect(looks.at(-1)?.backdrop?.scene).toBe(first)

  // Depth changes the water, and a surface draws a scene again only under a name it has not drawn.
  await ui.press({ key: 'hammerhead:depth-up' })
  expect(looks.at(-1)?.backdrop?.scene).not.toBe(first)

  // Three presses reach the least blur; the fourth changes nothing and sets no theme.
  for (let press = 0; press < 3; press++) await ui.press({ key: 'hammerhead:blur-down' })
  const count = looks.length
  await ui.press({ key: 'hammerhead:blur-down' })
  expect(looks.length).toBe(count)
  expect(store.get('settings')).toMatchObject({ blur: 0, depth: 4 })

  // Presses that land together are taken one after another: none reads the settings before the last has written.
  await Promise.all([ui.press({ key: 'hammerhead:veil-down' }), ui.press({ key: 'hammerhead:veil-down' }), ui.press({ key: 'hammerhead:veil-down' })])
  expect(store.get('settings')).toMatchObject({ veil: 40 })
  expect(looks.at(-1)?.backdrop?.glass).toEqual({ blur: 0, opacity: 0.4 })
  await ui.unmount()
})

test('after a /clear the sea is drawn under a name the surface has not drawn', async ($, on) => {
  const { looks } = engine(on)
  await $.session.start(START)
  const first = looks.at(-1)?.backdrop?.scene

  // The conversation ends without a new start, and its backdrop goes with it.
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await $.prompt.submit({ text: 'again', ...PROMPT })
  await settle()

  expect(looks.length).toBe(2)
  expect(looks.at(-1)?.backdrop?.scene).toContain(SCENE)
  expect(looks.at(-1)?.backdrop?.scene).not.toBe(first)
})

test("another session's change to the shared settings is drawn at the next prompt", async ($, on) => {
  const { looks, store } = engine(on)
  await $.session.start(START)
  await $.prompt.submit({ text: 'one', ...PROMPT })
  await settle()
  // Nothing changed: the prompt sets no theme.
  expect(looks.length).toBe(1)

  store.set('settings', { ...(store.get('settings') as object | undefined), dark: 'Nord' })
  await $.prompt.submit({ text: 'two', ...PROMPT })
  await settle()
  expect(looks.length).toBe(2)
  expect(looks.at(-1)?.colors?.label).toBe(`Nord / ${DEFAULTS.light}`)
})

test('a pasted scheme is kept, drawn in the mode its background belongs to, and can be removed', async ($, on) => {
  const { looks, store, asked } = engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))

  // Pasted while choosing for light mode: its background is dark, so it goes to dark mode and the pane follows.
  await ui.press({ key: 'hammerhead:slot-light' })
  await ui.press({ key: 'hammerhead:section-own' })
  await ui.input({ key: 'hammerhead:make', text: PASTED })

  expect(asked).toEqual([])
  expect(looks.at(-1)?.colors?.label).toBe(`Ember / ${DEFAULTS.light}`)
  expect(await ui.find({ type: 'Button', text: 'Ember' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Saved "Ember" for dark mode/ })).toBeDefined()

  await ui.press({ key: 'hammerhead:remove-Ember' })
  expect(looks.at(-1)?.colors?.label).toBe(`${DEFAULTS.dark} / ${DEFAULTS.light}`)
  expect(store.get('settings')).toMatchObject({ custom: [] })

  // A removal can be taken back until the next change, and the scheme returns as the one in force.
  await ui.press({ key: 'hammerhead:undo' })
  expect(looks.at(-1)?.colors?.label).toBe(`Ember / ${DEFAULTS.light}`)
  expect((store.get('settings') as { custom: { name: string }[] }).custom.map(one => one.name)).toEqual(['Ember'])
  expect(await ui.find({ type: 'Button', text: /Put "Ember" back/ })).toBeUndefined()

  await ui.press({ key: 'hammerhead:remove-Ember' })
  await ui.press({ key: 'hammerhead:pick-Nord' })
  expect(await ui.find({ type: 'Button', text: /Put "Ember" back/ })).toBeUndefined()
  await ui.unmount()
})

test('words go to the model, and its scheme is kept under the name it gave', async ($, on) => {
  const { looks, asked } = engine(on, `Here you go:\n\`\`\`json\n${PASTED}\n\`\`\``)
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))

  await ui.press({ key: 'hammerhead:section-own' })
  await ui.input({ key: 'hammerhead:make', text: 'embers in a dark room' })

  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('embers in a dark room')
  expect(looks.at(-1)?.colors?.label).toBe(`Ember / ${DEFAULTS.light}`)
  await ui.unmount()
})

test('a reply that is not a scheme changes nothing and says so', async ($, on) => {
  const { looks, asked } = engine(on, 'I would rather not.')
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))
  const before = looks.length

  await ui.press({ key: 'hammerhead:section-own' })
  await ui.input({ key: 'hammerhead:make', text: 'anything' })

  expect(looks.length).toBe(before)
  expect(await ui.find({ type: 'Text', text: /did not answer with a scheme/ })).toBeDefined()
  // The request is kept, and one press asks again.
  await ui.press({ key: 'hammerhead:retry' })
  expect(asked.length).toBe(2)
  expect(asked[1]).toContain('anything')
  await ui.unmount()
})
