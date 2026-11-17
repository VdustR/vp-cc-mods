import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Accent, Backdrop, LookSettings, Mode, Panel, Scheme, Section } from '../types'
import { colorsOf, easingOf, modeOf, seaOf } from './look'
import { PRESETS } from './presets'
import { buildScene } from './scene'
import { parseScheme } from './scheme'
import { ACCENTS, BLUR_MOST, BLUR_STEP, DEFAULT_LOOK, GLINTS, LEAST, MOST, STEP, VEIL_MOST, VEIL_STEP, glassOf, readSettings, schemeOf, schemesFor, withCustom } from './settings'

const PLUGIN = 'vp-cc-theme-hammerhead'
const SCENE_ID = 'hammerhead-sea'
// Named after the plugin, so a dev copy beside the installed plugin opens a pane of its own.
const PANE = 'vp-cc-theme-hammerhead-settings'
const PANE_TITLE = 'Hammerhead theme'
/** The one record in the plugin's store, which every session on the machine shares. */
const STORE_KEY = 'settings'

const settingsAtom = atom({ plugin: 'vp-cc-theme-hammerhead', key: 'settings' } as const, DEFAULT_LOOK)
const panelAtom = atom({ plugin: 'vp-cc-theme-hammerhead', key: 'panel' } as const, { slot: 'dark', open: ['schemes'], retry: '', notice: '', isBusy: false, isJsonShown: false })

/** Where the pane keeps which mode and which sections were last open, so it opens as it was left. */
const PANE_KEY = 'pane'

// The shark's route. One per load, so a redraw never moves the shark; "New route" draws another.
let seed = Math.floor(Math.random() * 2147483646)

// The sea as last drawn: built when the look is set, not in the render hook, which only hands it over.
let scene = ''

// A surface draws a backdrop again only when the look names a scene it has not drawn, so each drawing gets a name
// of its own: the scene id, this load's seed and a count. Without the count a new scheme recolors the app and
// leaves the old sea behind it; without the seed a reload starts the count again and meets names already drawn.
let drawing = 0

// What the count last stood for: the SVG and its glass. A change that leaves both alone (an accent, a button
// pressed at its limit) keeps the scene's name, so the sea is not drawn again and the shark swims on. A new name
// starts every animation over, which puts the shark back where its route begins.
let drawnAs = ''

// The settings the look on screen was drawn from. Every session shares the store, so another session may have
// changed them since.
let shown = ''

// Changes wait for one another: each reads the store, writes it and sets the theme, and two at once would lose a
// press or leave the older look on screen.
let queue: Promise<void> = Promise.resolve()

// Whether this load has set the theme for the conversation on screen. A /clear ends the conversation without a
// new `session.start`, and the theme goes with it, so the next prompt sets it again.
let isApplied = false

// What the model is asked for when a person describes a scheme in words.
const SCHEME_SYSTEM = `You design terminal color schemes. Answer with one JSON object and nothing else, in the Windows Terminal scheme format:
{"name": "...", "background": "#rrggbb", "foreground": "#rrggbb", "cursorColor": "#rrggbb", "selectionBackground": "#rrggbb", "black": "#rrggbb", "red": "#rrggbb", "green": "#rrggbb", "yellow": "#rrggbb", "blue": "#rrggbb", "purple": "#rrggbb", "cyan": "#rrggbb", "white": "#rrggbb", "brightBlack": "#rrggbb", "brightRed": "#rrggbb", "brightGreen": "#rrggbb", "brightYellow": "#rrggbb", "brightBlue": "#rrggbb", "brightPurple": "#rrggbb", "brightCyan": "#rrggbb", "brightWhite": "#rrggbb", "accent": "#rrggbb"}
Rules: every color is six-digit hex. For a dark scheme the background is dark and the foreground light; for a light scheme the reverse. The foreground has a contrast of at least 7:1 on the background. Red stays a red, green a green, yellow an amber, blue a blue, purple a purple and cyan a cyan, each tuned toward the mood asked for and clearly readable on the background. "accent" is the one color for buttons and links. "name" is a short English name of two or three words. If the request names a well-known scheme, use that scheme's real colors.`

/** Draws the look the settings ask for. */
async function draw($: EngineInterface, settings: LookSettings): Promise<void> {
  const dark = schemeOf(settings, 'dark')
  const light = schemeOf(settings, 'light')
  scene = buildScene(seed, {
    dark: seaOf(dark, settings.depth, settings.sharkTone),
    light: seaOf(light, settings.depth, settings.sharkTone),
    size: settings.size / 100,
    speed: settings.speed / 100,
    isSharkShown: settings.isSharkShown,
    waves: settings.waves,
    glints: settings.glints,
    waveSpeed: settings.waveSpeed / 100,
    isMoving: settings.backdrop === 'moving',
  })
  const isPlain = settings.backdrop === 'plain'
  const glass = glassOf(settings)
  const drawAs = isPlain ? 'plain' : JSON.stringify([scene, glass])
  if (drawAs !== drawnAs) {
    drawing += 1
    drawnAs = drawAs
  }
  await $.theme.set({
    colors: colorsOf(dark, light, { depth: settings.depth, layers: settings.layers, accent: settings.accent, isCodeThemed: settings.isCodeThemed }, settings.isHighContrast),
    // Plain is the page's own color, which follows the mode; a still ground takes no glass.
    backdrop: isPlain ? { color: 'surface-0' } : { scene: `${SCENE_ID}-${seed}-${drawing}`, glass },
  })
  shown = JSON.stringify(settings)
}

/** The settings as the store has them now, copied to this session's state for the pane to read. */
async function load($: EngineInterface): Promise<LookSettings> {
  const settings = readSettings(await $.store.get(STORE_KEY))
  await update($, settingsAtom, () => settings)

  return settings
}

/**
 * Sets the theme and never throws: a look must not cost the session its start or the person their prompt.
 * It says nothing where no surface draws a look (the terminal, an editor): there is nothing to fix there.
 */
async function apply($: EngineInterface): Promise<void> {
  try {
    await draw($, await load($))
    isApplied = true
  } catch {
    isApplied = false
  }
}

/**
 * Changes the settings and draws the result. The store is read again right before the write, since every session
 * shares it and a read followed by a write is not atomic.
 */
async function alter($: EngineInterface, edit: (settings: LookSettings) => LookSettings, notice: string, isRedrawn: boolean): Promise<void> {
  const stored = readSettings(await $.store.get(STORE_KEY))
  const next = readSettings(edit(stored))
  const isSame = JSON.stringify(next) === JSON.stringify(stored)
  if (!isSame) await $.store.set(STORE_KEY, next)
  await update($, settingsAtom, () => next)
  await update($, panelAtom, panel => ({ ...panel, notice, isBusy: false }))
  // A press that changes nothing, such as a step past its limit, draws nothing.
  if (isSame && !isRedrawn && isApplied && shown === JSON.stringify(next)) return
  try {
    await draw($, next)
    isApplied = true
  } catch {
    await update($, panelAtom, panel => ({ ...panel, notice: 'Saved, but the look could not be drawn here.' }))
  }
}

/** Changes the settings, after any change already under way. `isRedrawn` draws even when the settings stay as they were. */
function change($: EngineInterface, edit: (settings: LookSettings) => LookSettings, notice: string, isRedrawn = false): Promise<void> {
  queue = queue.then(() => alter($, edit, notice, isRedrawn)).catch(() => {})

  return queue
}

/**
 * Before a prompt: sets the theme when this conversation has none, or when another session changed the settings
 * since this one drew them. Never throws.
 */
async function refresh($: EngineInterface): Promise<void> {
  try {
    if (isApplied && JSON.stringify(readSettings(await $.store.get(STORE_KEY))) === shown) return
  } catch {
    return
  }
  await apply($)
}

async function say($: EngineInterface, notice: string): Promise<void> {
  await update($, panelAtom, panel => ({ ...panel, notice, isBusy: false }))
}

/** Says a request to the model came to nothing, and keeps it so the pane can offer it again. */
async function fail($: EngineInterface, request: string, notice: string): Promise<void> {
  await update($, panelAtom, panel => ({ ...panel, notice, isBusy: false, retry: request }))
}

/** Changes what the pane shows, and keeps the mode and the open sections for the next time it opens. */
async function show($: EngineInterface, edit: (panel: Panel) => Panel): Promise<void> {
  const next = await update($, panelAtom, edit)
  try {
    await $.store.set(PANE_KEY, { slot: next.slot, open: next.open })
  } catch {
    // The pane works without remembering how it was left.
  }
}

/** Saves a scheme of the person's own and draws it in the mode it belongs to. */
async function keep($: EngineInterface, scheme: Scheme, slot: Mode): Promise<void> {
  const mode = modeOf(scheme)
  const where = mode === slot ? `${mode} mode` : `${mode} mode, since its background is ${mode}`
  await update($, panelAtom, panel => ({ ...panel, slot: mode }))
  const settings = await read($, settingsAtom)
  // The app refuses a whole theme over one piece of text it cannot read, so a scheme is eased until it passes.
  const { left, isFirmer, isPainted } = easingOf(scheme, { depth: settings.depth, layers: settings.layers, accent: settings.accent, isCodeThemed: settings.isCodeThemed })
  const eased = !isPainted
    ? ' The app will not paint it: its background is neither dark enough nor light enough, so the app keeps its own colors while it is chosen.'
    : (isFirmer ? ' Its text is drawn brighter or darker than the scheme asks, so the app can paint it.' : '') +
    (left.length === 0 ? '' : ` The app could not paint its ${left.join(', ')}, so ${left.length === 1 ? 'that color is' : 'those colors are'} the app's own.`)
  await change($, now => withCustom(now, scheme), `Saved "${scheme.name}" for ${where}.${eased}`)
}

/** Takes what the person typed in the pane: a pasted scheme, or words for the model to make one from. */
async function make($: EngineInterface, text: string): Promise<void> {
  const request = text.trim()
  if (request === '') return
  const { slot } = await read($, panelAtom)
  if (request.includes('{')) {
    const pasted = parseScheme(request, 'My scheme')
    await (typeof pasted === 'string' ? say($, pasted) : keep($, pasted, slot))

    return
  }
  await update($, panelAtom, panel => ({ ...panel, isBusy: true, retry: '', notice: `Asking Claude for a ${slot} scheme...` }))
  try {
    const reply = await $.model.complete({
      model: 'sonnet',
      system: SCHEME_SYSTEM,
      prompt: `Design a ${slot} scheme. The request: ${request.slice(0, 600)}`,
      maxTokens: 1200,
    })
    if (!reply.isAnswered) {
      await fail($, request, 'Claude could not be reached.')

      return
    }
    const made = parseScheme(reply.text, request.slice(0, 32))
    await (typeof made === 'string' ? fail($, request, 'Claude did not answer with a scheme. Try again, or use other words.') : keep($, made, slot))
  } catch {
    await fail($, request, 'Claude could not be reached.')
  }
}

const SECTIONS: readonly Section[] = ['schemes', 'own', 'sea', 'shark', 'app']

async function openPane($: EngineInterface): Promise<boolean> {
  await load($)
  try {
    const kept = (await $.store.get(PANE_KEY)) as { slot?: unknown; open?: unknown } | undefined
    const open = Array.isArray(kept?.open) ? SECTIONS.filter(section => (kept.open as unknown[]).includes(section)) : undefined
    await update($, panelAtom, panel => ({
      ...panel,
      slot: kept?.slot === 'light' || kept?.slot === 'dark' ? kept.slot : panel.slot,
      open: open ?? panel.open,
    }))
  } catch {
    // The pane opens on what this session last showed.
  }
  const opened = await $.ui.open({ id: PANE, title: PANE_TITLE })

  return opened.isPlaced
}

function step(value: number, by: number): number {
  return Math.max(LEAST, Math.min(MOST, value + by))
}

/** The scheme as a person would save or edit it: the terminal format, with this plugin's one extra key last. */
function toJson(scheme: Scheme): string {
  return JSON.stringify(scheme, null, 2)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await apply($)
    try {
      await $.command.register({ name: PLUGIN, description: 'Choose the theme: a color scheme for dark and light mode, and the sea behind the chat' })
    } catch {
      // The look stands without its command.
    }

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
    void refresh($)

    return next(e)
  })

  on('command.run', { command: PLUGIN }, async $ => {
    const isPlaced = await openPane($)

    return isPlaced ? {} : { text: 'The theme settings open in a pane, and nothing here can show one.' }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // Every plugin's hook hears every backdrop: leave another plugin's scene alone.
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.plugin !== PLUGIN || !e.props.scene.startsWith(SCENE_ID) || scene === '') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={scene} alt="A hammerhead silhouette cruising a calm sea, seen from above, under slow ribbons" />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input, Code } = $.ui.resolve(e)
    const settings = await read($, settingsAtom)
    const panel = await read($, panelAtom)
    const { slot } = panel
    // State kept from an earlier version of the pane has no list of open sections.
    const open: readonly Section[] = panel.open ?? ['schemes']
    const chosen = schemeOf(settings, slot)
    const isSea = settings.backdrop !== 'plain'
    const isOwn = (scheme: Scheme): boolean => !PRESETS.some(preset => preset.name === scheme.name)

    /** A setting's name, then its controls on one line. */
    const row = (label: string, controls: RenderChildren) => (
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Box width={12}>
          <Text>{label}</Text>
        </Box>
        {controls}
      </Box>
    )
    /** Two buttons either side of a value. */
    const stepper = (key: string, less: string, more: string, value: string, down: (now: LookSettings) => LookSettings, up: (now: LookSettings) => LookSettings) => [
      <Button key={`hammerhead:${key}-down`} label={less} onPress={() => change($, down, '')} />,
      <Box key={`value-${key}`} width={6} justifyContent="center">
        <Text tabular>{value}</Text>
      </Box>,
      <Button key={`hammerhead:${key}-up`} label={more} onPress={() => change($, up, '')} />,
    ]
    /** A button that is lit while its choice is the one in force. */
    const pick = (key: string, label: string, isOn: boolean, edit: (now: LookSettings) => LookSettings, notice = '') => (
      <Button key={`hammerhead:${key}`} label={label} variant={isOn ? 'primary' : 'secondary'} onPress={() => change($, edit, notice)} />
    )
    /** A part of the pane under a heading that opens and closes it. Closed, it says in one line what it holds. */
    const section = (id: Section, title: string, summary: string, body: RenderChildren) => {
      const isOpen = open.includes(id)

      return (
        <Box key={`section-${id}`} flexDirection="column" gap={1}>
          <Button
            key={`hammerhead:section-${id}`}
            label={`${isOpen ? '▾' : '▸'} ${title}`}
            plain
            onPress={() => show($, now => ({ ...now, open: isOpen ? (now.open ?? []).filter(one => one !== id) : [...(now.open ?? []), id] }))}
          />
          {isOpen ? body : <Text dimColor>{summary}</Text>}
        </Box>
      )
    }
    const tab = (mode: Mode, label: string) => (
      <Button
        key={`hammerhead:slot-${mode}`}
        label={`${label}: ${schemeOf(settings, mode).name}`}
        variant={slot === mode ? 'primary' : 'secondary'}
        onPress={() => show($, now => ({ ...now, slot: mode, notice: '' }))}
      />
    )
    const swatches = (colors: readonly string[], name: string) =>
      colors.map((color, at) => (
        <Text key={`${name}-${at}`} backgroundColor={color} color={color}>
          {'██'}
        </Text>
      ))

    return (
      <Box flexDirection="column" gap={1} padding={1}>
        <Text dimColor>One scheme for dark mode and one for light. The app's own appearance setting picks between them.</Text>
        <Box gap={1} flexWrap="wrap">
          {tab('dark', 'Dark')}
          {tab('light', 'Light')}
        </Box>

        {section(
          'schemes',
          'Schemes',
          `${chosen.name}, of ${schemesFor(settings, slot).length} for ${slot} mode.`,
          <Box flexDirection="column">
            <Text dimColor>Each row: the scheme's colors, then its water, its ribbons and its shark.</Text>
            {schemesFor(settings, slot).map(scheme => {
              const sea = seaOf(scheme, settings.depth, settings.sharkTone)

              return (
                <Box key={`row-${scheme.name}`} gap={1} alignItems="center">
                  <Box flexGrow={1}>
                    {pick(
                      `pick-${scheme.name}`,
                      scheme.name,
                      scheme.name === chosen.name,
                      now => (slot === 'dark' ? { ...now, dark: scheme.name } : { ...now, light: scheme.name }),
                      `${slot === 'dark' ? 'Dark' : 'Light'} mode: ${scheme.name}.`,
                    )}
                  </Box>
                  <Box>{swatches([scheme.background, scheme.foreground, scheme.red, scheme.yellow, scheme.green, scheme.cyan, scheme.blue, scheme.purple], 'color')}</Box>
                  <Box>{swatches([sea.mid, sea.light, sea.shark], 'sea')}</Box>
                  {isOwn(scheme) && (
                    <Button
                      key={`hammerhead:remove-${scheme.name}`}
                      label={`Remove ${scheme.name}`}
                      plain
                      dimColor
                      onPress={() => change($, now => ({ ...now, custom: now.custom.filter(one => one.name !== scheme.name) }), `Removed "${scheme.name}".`)}
                    />
                  )}
                </Box>
              )
            })}
          </Box>,
        )}

        {section(
          'own',
          `Your own scheme, for ${slot} mode`,
          'Describe one for Claude to write, or paste one. To change one of yours, paste it again under the same name.',
          <Box flexDirection="column" gap={1}>
            <Text dimColor>Say what you want in a few words and Claude writes one, or paste a scheme in the Windows Terminal format, as iTerm2-Color-Schemes publishes them. A scheme pasted under the name of one of yours takes its place.</Text>
            <Input key="hammerhead:make" rows={2} placeholder="warm coffee and cream, low contrast" submitLabel="make" onSubmit={text => make($, text)} />
            <Button
              key="hammerhead:json"
              label={panel.isJsonShown ? `Hide "${chosen.name}" as JSON` : `Show "${chosen.name}" as JSON`}
              plain
              dimColor
              onPress={() => update($, panelAtom, now => ({ ...now, isJsonShown: !now.isJsonShown }))}
            />
            {panel.isJsonShown && <Code source={toJson(chosen)} language="json" />}
          </Box>,
        )}

        {section(
          'sea',
          'The sea',
          settings.backdrop === 'plain' ? 'Plain: the background alone.' : `${settings.backdrop === 'moving' ? 'Moving' : 'Still'}, depth ${settings.depth}, ${settings.waves} waves, blur ${settings.blur}, veil ${settings.veil}%.`,
          <Box flexDirection="column" gap={1}>
            {row('Backdrop', [
              pick('backdrop-moving', 'Moving', settings.backdrop === 'moving', now => ({ ...now, backdrop: 'moving' as Backdrop })),
              pick('backdrop-still', 'Still', settings.backdrop === 'still', now => ({ ...now, backdrop: 'still' as Backdrop })),
              pick('backdrop-plain', 'Plain', settings.backdrop === 'plain', now => ({ ...now, backdrop: 'plain' as Backdrop })),
            ])}
            {!isSea && <Text dimColor>Plain is the scheme's background alone: no sea, no shark, no glass.</Text>}
            {isSea && row('Depth', stepper('depth', 'Shallower', 'Deeper', String(settings.depth), now => ({ ...now, depth: Math.max(1, now.depth - 1) }), now => ({ ...now, depth: Math.min(10, now.depth + 1) })))}
            {isSea && row('Blur', stepper('blur', 'Sharper', 'Blurrier', String(settings.blur), now => ({ ...now, blur: Math.max(0, now.blur - BLUR_STEP) }), now => ({ ...now, blur: Math.min(BLUR_MOST, now.blur + BLUR_STEP) })))}
            {isSea && row('Veil', stepper('veil', 'Thinner', 'Thicker', `${settings.veil}%`, now => ({ ...now, veil: Math.max(0, now.veil - VEIL_STEP) }), now => ({ ...now, veil: Math.min(VEIL_MOST, now.veil + VEIL_STEP) })))}
            {isSea && <Text dimColor>Blur softens the sea. Veil lays the app's panel color over it: a thick veil makes message bubbles solid, a thin one leaves them see-through.</Text>}
            {isSea && row('Waves', stepper('waves', 'Fewer waves', 'More waves', String(settings.waves), now => ({ ...now, waves: Math.max(3, now.waves - 2) }), now => ({ ...now, waves: Math.min(7, now.waves + 2) })))}
            {isSea && row('Wave speed', stepper('wave-speed', 'Calmer', 'Livelier', `${settings.waveSpeed}%`, now => ({ ...now, waveSpeed: step(now.waveSpeed, -STEP) }), now => ({ ...now, waveSpeed: step(now.waveSpeed, STEP) })))}
            {isSea &&
              row(
                'Glints',
                stepper(
                  'glints',
                  'Fewer glints',
                  'More glints',
                  String(settings.glints),
                  now => ({ ...now, glints: GLINTS[Math.max(0, GLINTS.indexOf(now.glints) - 1)] ?? 0 }),
                  now => ({ ...now, glints: GLINTS[Math.min(GLINTS.length - 1, GLINTS.indexOf(now.glints) + 1)] ?? 22 }),
                ),
              )}
            <Button
              key="hammerhead:reset-sea"
              label="Reset the sea"
              plain
              dimColor
              onPress={() =>
                change(
                  $,
                  now => ({ ...now, backdrop: DEFAULT_LOOK.backdrop, depth: DEFAULT_LOOK.depth, blur: DEFAULT_LOOK.blur, veil: DEFAULT_LOOK.veil, waves: DEFAULT_LOOK.waves, waveSpeed: DEFAULT_LOOK.waveSpeed, glints: DEFAULT_LOOK.glints }),
                  'The sea is back to its defaults.',
                )
              }
            />
          </Box>,
        )}

        {isSea &&
          section(
            'shark',
            'The shark',
            settings.isSharkShown ? `Shown, tone ${settings.sharkTone}, size ${settings.size}%, speed ${settings.speed}%.` : 'Hidden.',
            <Box flexDirection="column" gap={1}>
              {row('Shark', [
                pick('shark', settings.isSharkShown ? 'Shown' : 'Hidden', settings.isSharkShown, now => ({ ...now, isSharkShown: !now.isSharkShown })),
                <Button
                  key="hammerhead:route"
                  label="New route"
                  onPress={() => {
                    seed = Math.floor(Math.random() * 2147483646)

                    return change($, now => now, 'The shark took a new route.', true)
                  }}
                />,
              ])}
              {row('Tone', stepper('shark-tone', 'Fainter', 'Bolder', String(settings.sharkTone), now => ({ ...now, sharkTone: Math.max(1, now.sharkTone - 1) }), now => ({ ...now, sharkTone: Math.min(10, now.sharkTone + 1) })))}
              {row('Size', stepper('size', 'Smaller', 'Larger', `${settings.size}%`, now => ({ ...now, size: step(now.size, -STEP) }), now => ({ ...now, size: step(now.size, STEP) })))}
              {row('Swim speed', stepper('speed', 'Slower', 'Faster', `${settings.speed}%`, now => ({ ...now, speed: step(now.speed, -STEP) }), now => ({ ...now, speed: step(now.speed, STEP) })))}
              <Button
                key="hammerhead:reset-shark"
                label="Reset the shark"
                plain
                dimColor
                onPress={() =>
                  change($, now => ({ ...now, isSharkShown: DEFAULT_LOOK.isSharkShown, sharkTone: DEFAULT_LOOK.sharkTone, size: DEFAULT_LOOK.size, speed: DEFAULT_LOOK.speed }), 'The shark is back to its defaults.')
                }
              />
            </Box>,
          )}

        {section(
          'app',
          'The app',
          `Layers ${settings.layers}, ${settings.accent === 'scheme' ? "the scheme's accent" : `${settings.accent} accent`}${settings.isCodeThemed ? ", the scheme's code theme" : ''}${settings.isHighContrast ? ', stronger borders' : ''}.`,
          <Box flexDirection="column" gap={1}>
            {row('Layers', stepper('layers', 'Flatter', 'More layered', String(settings.layers), now => ({ ...now, layers: Math.max(0, now.layers - 1) }), now => ({ ...now, layers: Math.min(6, now.layers + 1) })))}
            {row(
              'Accent',
              ACCENTS.map(choice =>
                pick(`accent-${choice}`, choice === 'scheme' ? "The scheme's" : choice[0]!.toUpperCase() + choice.slice(1), settings.accent === choice, now => ({ ...now, accent: choice as Accent })),
              ),
            )}
            {row('Code', pick('code-theme', "Use the scheme's code theme", settings.isCodeThemed, now => ({ ...now, isCodeThemed: !now.isCodeThemed })))}
            {row('Contrast', pick('contrast', 'Stronger borders', settings.isHighContrast, now => ({ ...now, isHighContrast: !now.isHighContrast })))}
            <Button
              key="hammerhead:reset-app"
              label="Reset the app"
              plain
              dimColor
              onPress={() =>
                change($, now => ({ ...now, layers: DEFAULT_LOOK.layers, accent: DEFAULT_LOOK.accent, isCodeThemed: DEFAULT_LOOK.isCodeThemed, isHighContrast: DEFAULT_LOOK.isHighContrast }), 'The app is back to its defaults.')
              }
            />
          </Box>,
        )}

        {panel.notice !== '' && <Text color={panel.isBusy ? undefined : 'text-secondary'}>{panel.notice}</Text>}
        {(panel.retry ?? '') !== '' && !panel.isBusy && <Button key="hammerhead:retry" label="Try again" onPress={() => make($, panel.retry)} />}

        <Box>
          <Button
            key="hammerhead:reset"
            label="Reset everything"
            plain
            dimColor
            onPress={() => change($, now => ({ ...DEFAULT_LOOK, custom: now.custom }), 'Back to the defaults. Your own schemes are kept.')}
          />
        </Box>
      </Box>
    )
  })
}
