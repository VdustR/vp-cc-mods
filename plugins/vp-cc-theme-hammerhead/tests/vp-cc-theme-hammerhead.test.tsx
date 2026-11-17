import { expect, test } from 'claude-code/testing'

const PLUGIN = 'vp-cc-theme-hammerhead'
const SCENE = 'hammerhead-sea'

type On = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1]
type Look = {
  colors?: { inputs?: { light?: object; dark?: object } }
  backdrop?: { scene?: string; glass?: unknown }
}

const PROMPT = { origin: { kind: 'composer' }, wait: false } as const
const START = { cwd: '/tmp/project', surface: 'desktop', isInteractive: true } as const

// Stand in for the engine: record each theme the plugin sets and each toast it raises.
const engine = (on: On, isDrawn = true) => {
  const looks: Look[] = []
  const toasts: string[] = []
  on('theme.set', (_$, e) => {
    looks.push(e as Look)

    return { value: isDrawn ? { isDrawn: true, requestId: 'r1' } : { isDrawn: false, reason: 'no surface draws themes' } }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))

    return { value: undefined }
  })

  // Nothing sits beneath a test's hooks, so answer the events the tests raise.
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  return { looks, toasts }
}

const backdrop = (plugin: string, scene: string) =>
  ({ component: 'Backdrop', props: { scene, plugin, glass: { blur: 4, opacity: 0.4 } } }) as const

test('the session starts with colors for both modes and the sea as its backdrop', async ($, on) => {
  const { looks } = engine(on)

  await $.session.start(START)

  expect(looks.length).toBe(1)
  const look = looks[0]!
  // Gruvbox in dark mode and Everforest in light mode: both halves are given, so the look follows the app's mode.
  expect(Object.keys(look.colors?.inputs?.dark ?? {}).length).toBeGreaterThan(0)
  expect(Object.keys(look.colors?.inputs?.light ?? {}).length).toBeGreaterThan(0)
  expect(look.backdrop?.scene).toBe(SCENE)
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

test('where no surface draws a look, the plugin stays silent', async ($, on) => {
  const { looks, toasts } = engine(on, false)

  await $.session.start({ ...START, surface: 'terminal' })

  expect(looks.length).toBe(1)
  expect(toasts).toEqual([])
})

test('after /clear the next prompt sets the theme again, and later prompts do not', async ($, on) => {
  const { looks } = engine(on)
  await $.session.start(START)
  expect(looks.length).toBe(1)

  await $.prompt.submit({ ...PROMPT, text: 'hello' })
  expect(looks.length).toBe(1)

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await $.prompt.submit({ ...PROMPT, text: 'hello again' })
  expect(looks.length).toBe(2)

  await $.prompt.submit({ ...PROMPT, text: 'and again' })
  expect(looks.length).toBe(2)
})
