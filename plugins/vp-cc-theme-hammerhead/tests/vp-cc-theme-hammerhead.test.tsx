import { expect, test } from 'claude-code/testing'

import { contrast, mix } from '../hooks/color'
import { depthContrast, isPainted, modeOf, seaOf } from '../hooks/look'
import { DEFAULTS, PRESETS } from '../hooks/presets'
import { parseScheme } from '../hooks/scheme'

const PLUGIN = 'vp-cc-theme-hammerhead'
const SCENE = 'hammerhead-sea'
const PANE = 'hammerhead-theme'

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

  for (const scheme of PRESETS) {
    const isDark = modeOf(scheme) === 'dark'
    // The shallowest, the default and the deepest sea: each depth moves the ground the text is read on.
    for (const depth of [1, 3, 10]) {
      // The Desktop app ignores a whole theme when one piece of text is under its floor.
      expect(isPainted(isDark ? scheme : darks[0]!, isDark ? lights[0]! : scheme, depth)).toBe(true)

      const sea = seaOf(scheme, depth)
      const crest = mix(sea.mid, sea.light, sea.crestOpacity)
      const shark = mix(sea.mid, sea.shark, sea.sharkOpacity)
      // The same contrast on every scheme, pale or black: that is what keeps the waves visible.
      expect(contrast(crest, sea.mid)).toBeGreaterThan(1 + (depthContrast(depth) - 1) * 0.85)
      expect(contrast(shark, sea.mid)).toBeGreaterThan(2)
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
    expect(await ui.find({ type: 'Button', text: 'Catppuccin Latte' })).toBeUndefined()
    await ui.press({ key: 'hammerhead:pick-Catppuccin Mocha' })
    expect(looks.at(-1)?.colors?.label).toBe(`Catppuccin Mocha / ${DEFAULTS.light}`)

    await ui.press({ key: 'hammerhead:slot-light' })
    await ui.press({ key: 'hammerhead:pick-Catppuccin Latte' })
    expect(looks.at(-1)?.colors?.label).toBe('Catppuccin Mocha / Catppuccin Latte')
    expect(store.get('settings')).toMatchObject({ dark: 'Catppuccin Mocha', light: 'Catppuccin Latte' })

    await ui.press({ key: 'hammerhead:glass-frosted' })
    expect((looks.at(-1)?.backdrop?.glass || { opacity: 0 }).opacity).toBeGreaterThan(0.4)

    await ui.press({ key: 'hammerhead:size-up' })
    await ui.press({ key: 'hammerhead:speed-down' })
    await ui.press({ key: 'hammerhead:shark' })
    expect(store.get('settings')).toMatchObject({ size: 125, speed: 75, isSharkShown: false })

    await ui.press({ key: 'hammerhead:glass-off' })
    expect(looks.at(-1)?.backdrop?.glass).toBe(false)
    await ui.press({ key: 'hammerhead:depth-up' })
    expect(store.get('settings')).toMatchObject({ depth: 4 })
    await ui.press({ key: 'hammerhead:waves-up' })
    await ui.press({ key: 'hammerhead:glints' })
    await ui.press({ key: 'hammerhead:contrast' })
    expect(store.get('settings')).toMatchObject({ waves: 7, hasGlints: false, isHighContrast: true })
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

test('a pasted scheme is kept, drawn in the mode its background belongs to, and can be removed', async ($, on) => {
  const { looks, store, asked } = engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))

  // Pasted while choosing for light mode: its background is dark, so it goes to dark mode and the pane follows.
  await ui.press({ key: 'hammerhead:slot-light' })
  await ui.input({ key: 'hammerhead:make', text: PASTED })

  expect(asked).toEqual([])
  expect(looks.at(-1)?.colors?.label).toBe(`Ember / ${DEFAULTS.light}`)
  expect(await ui.find({ type: 'Button', text: 'Ember' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Saved "Ember" for dark mode/ })).toBeDefined()

  await ui.press({ key: 'hammerhead:remove-Ember' })
  expect(looks.at(-1)?.colors?.label).toBe(`${DEFAULTS.dark} / ${DEFAULTS.light}`)
  expect(store.get('settings')).toMatchObject({ custom: [] })
  await ui.unmount()
})

test('words go to the model, and its scheme is kept under the name it gave', async ($, on) => {
  const { looks, asked } = engine(on, `Here you go:\n\`\`\`json\n${PASTED}\n\`\`\``)
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))

  await ui.input({ key: 'hammerhead:make', text: 'embers in a dark room' })

  expect(asked.length).toBe(1)
  expect(asked[0]).toContain('embers in a dark room')
  expect(looks.at(-1)?.colors?.label).toBe(`Ember / ${DEFAULTS.light}`)
  await ui.unmount()
})

test('a reply that is not a scheme changes nothing and says so', async ($, on) => {
  const { looks } = engine(on, 'I would rather not.')
  await $.session.start(START)
  const ui = await $.ui.mount(pane('desktop'))
  const before = looks.length

  await ui.input({ key: 'hammerhead:make', text: 'anything' })

  expect(looks.length).toBe(before)
  expect(await ui.find({ type: 'Text', text: /did not answer with a scheme/ })).toBeDefined()
  await ui.unmount()
})
