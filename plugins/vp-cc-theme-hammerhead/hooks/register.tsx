import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Backdrop, Glass, LookSettings, Mode, Panel, Scheme } from '../types'
import { colorsOf, modeOf, seaOf } from './look'
import { PRESETS } from './presets'
import { buildScene } from './scene'
import { parseScheme } from './scheme'
import { DEFAULT_LOOK, GLASS, LEAST, MOST, STEP, readSettings, schemeOf, schemesFor, withCustom } from './settings'

const PLUGIN = 'vp-cc-theme-hammerhead'
const SCENE_ID = 'hammerhead-sea'
const PANE = 'hammerhead-theme'
const PANE_TITLE = 'Hammerhead theme'
/** The one record in the plugin's store, which every session on the machine shares. */
const STORE_KEY = 'settings'

const settingsAtom = atom({ plugin: 'vp-cc-theme-hammerhead', key: 'settings' } as const, DEFAULT_LOOK)
const panelAtom = atom({ plugin: 'vp-cc-theme-hammerhead', key: 'panel' } as const, { slot: 'dark', notice: '', isBusy: false, isJsonShown: false })

// The shark's route. One per load, so a redraw never moves the shark; "New route" draws another.
let seed = Math.floor(Math.random() * 2147483646)

// The sea as last drawn: built when the look is set, not in the render hook, which only hands it over.
let scene = ''

// A surface draws a backdrop again only when the look names another scene, so each drawing gets a name of its own:
// the scene id and a count. Without it a new scheme recolors the app and leaves the old sea behind it.
let drawing = 0

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
    dark: seaOf(dark),
    light: seaOf(light),
    size: settings.size / 100,
    speed: settings.speed / 100,
    isSharkShown: settings.isSharkShown,
    waves: settings.waves,
    hasGlints: settings.hasGlints,
    isMoving: settings.backdrop === 'moving',
  })
  drawing += 1
  await $.theme.set({
    colors: colorsOf(dark, light, settings.isHighContrast),
    // Plain is the page's own color, which follows the mode; a still ground takes no glass.
    backdrop: settings.backdrop === 'plain' ? { color: 'surface-0' } : { scene: `${SCENE_ID}-${drawing}`, glass: GLASS[settings.glass] },
  })
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
async function change($: EngineInterface, edit: (settings: LookSettings) => LookSettings, notice: string): Promise<void> {
  const next = readSettings(edit(readSettings(await $.store.get(STORE_KEY))))
  await $.store.set(STORE_KEY, next)
  await update($, settingsAtom, () => next)
  await update($, panelAtom, panel => ({ ...panel, notice, isBusy: false }))
  try {
    await draw($, next)
    isApplied = true
  } catch {
    await update($, panelAtom, panel => ({ ...panel, notice: 'Saved, but the look could not be drawn here.' }))
  }
}

async function say($: EngineInterface, notice: string): Promise<void> {
  await update($, panelAtom, panel => ({ ...panel, notice, isBusy: false }))
}

/** Saves a scheme of the person's own and draws it in the mode it belongs to. */
async function keep($: EngineInterface, scheme: Scheme, slot: Mode): Promise<void> {
  const mode = modeOf(scheme)
  const where = mode === slot ? `${mode} mode` : `${mode} mode, since its background is ${mode}`
  await update($, panelAtom, panel => ({ ...panel, slot: mode }))
  await change($, settings => withCustom(settings, scheme), `Saved "${scheme.name}" for ${where}.`)
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
  await update($, panelAtom, panel => ({ ...panel, isBusy: true, notice: `Asking Claude for a ${slot} scheme...` }))
  try {
    const reply = await $.model.complete({
      model: 'sonnet',
      system: SCHEME_SYSTEM,
      prompt: `Design a ${slot} scheme. The request: ${request.slice(0, 600)}`,
      maxTokens: 1200,
    })
    if (!reply.isAnswered) {
      await say($, 'Claude could not be reached. Try again, or paste a scheme.')

      return
    }
    const made = parseScheme(reply.text, request.slice(0, 32))
    await (typeof made === 'string' ? say($, 'Claude did not answer with a scheme. Try other words, or paste one.') : keep($, made, slot))
  } catch {
    await say($, 'Claude could not be reached. Try again, or paste a scheme.')
  }
}

async function openPane($: EngineInterface): Promise<boolean> {
  await load($)
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
    if (!isApplied) {
      void apply($).catch(() => {})
    }

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
    const chosen = schemeOf(settings, slot)
    const isOwn = (scheme: Scheme): boolean => !PRESETS.some(preset => preset.name === scheme.name)
    const tab = (mode: Mode, label: string) => (
      <Button
        key={`hammerhead:slot-${mode}`}
        label={`${label}: ${schemeOf(settings, mode).name}`}
        variant={slot === mode ? 'primary' : 'secondary'}
        onPress={() => update($, panelAtom, now => ({ ...now, slot: mode, notice: '' }))}
      />
    )
    const glass = (kind: Glass, label: string) => (
      <Button
        key={`hammerhead:glass-${kind}`}
        label={label}
        variant={settings.glass === kind ? 'primary' : 'secondary'}
        onPress={() => change($, now => ({ ...now, glass: kind }), `Glass: ${label.toLowerCase()}.`)}
      />
    )
    const backdrop = (kind: Backdrop, label: string) => (
      <Button
        key={`hammerhead:backdrop-${kind}`}
        label={label}
        variant={settings.backdrop === kind ? 'primary' : 'secondary'}
        onPress={() => change($, now => ({ ...now, backdrop: kind }), `Backdrop: ${label.toLowerCase()}.`)}
      />
    )
    const toggle = (key: string, label: string, isOn: boolean, flip: (now: LookSettings) => LookSettings) => (
      <Button key={`hammerhead:${key}`} label={label} variant={isOn ? 'primary' : 'secondary'} onPress={() => change($, flip, '')} />
    )
    const isSea = settings.backdrop !== 'plain'
    const stepper = (field: 'size' | 'speed', label: string, less: string, more: string) => (
      <Box gap={1} alignItems="center">
        <Box width={12}>
          <Text>{label}</Text>
        </Box>
        <Button
          key={`hammerhead:${field}-down`}
          label={less}
          onPress={() => change($, now => (field === 'size' ? { ...now, size: step(now.size, -STEP) } : { ...now, speed: step(now.speed, -STEP) }), '')}
        />
        <Box width={6} justifyContent="center">
          <Text tabular>{`${field === 'size' ? settings.size : settings.speed}%`}</Text>
        </Box>
        <Button
          key={`hammerhead:${field}-up`}
          label={more}
          onPress={() => change($, now => (field === 'size' ? { ...now, size: step(now.size, STEP) } : { ...now, speed: step(now.speed, STEP) }), '')}
        />
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1} padding={1}>
        <Text dimColor>One scheme for dark mode and one for light. The app's own appearance setting picks between them.</Text>
        <Box gap={1} flexWrap="wrap">
          {tab('dark', 'Dark')}
          {tab('light', 'Light')}
        </Box>

        <Box flexDirection="column">
          {schemesFor(settings, slot).map(scheme => (
            <Box key={`row-${scheme.name}`} gap={1} alignItems="center">
              <Box flexGrow={1}>
                <Button
                  key={`hammerhead:pick-${scheme.name}`}
                  label={scheme.name}
                  variant={scheme.name === chosen.name ? 'primary' : 'secondary'}
                  onPress={() => change($, now => (slot === 'dark' ? { ...now, dark: scheme.name } : { ...now, light: scheme.name }), `${slot === 'dark' ? 'Dark' : 'Light'} mode: ${scheme.name}.`)}
                />
              </Box>
              <Box>
                {[scheme.background, scheme.foreground, scheme.red, scheme.yellow, scheme.green, scheme.cyan, scheme.blue, scheme.purple].map((color, at) => (
                  <Text key={`swatch-${at}`} backgroundColor={color} color={color}>
                    {'██'}
                  </Text>
                ))}
              </Box>
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
          ))}
        </Box>

        <Box flexDirection="column">
          <Text bold>Your own scheme, for {slot} mode</Text>
          <Text dimColor>Say what you want in a few words and Claude writes one, or paste a scheme in the Windows Terminal format, as iTerm2-Color-Schemes publishes them.</Text>
          <Input
            key="hammerhead:make"
            rows={2}
            placeholder="warm coffee and cream, low contrast"
            submitLabel="make"
            onSubmit={text => make($, text)}
          />
          {panel.notice !== '' && <Text color={panel.isBusy ? undefined : 'text-secondary'}>{panel.notice}</Text>}
        </Box>

        <Box flexDirection="column">
          <Box gap={1} alignItems="center">
            <Button
              key="hammerhead:json"
              label={panel.isJsonShown ? `Hide "${chosen.name}" as JSON` : `Show "${chosen.name}" as JSON`}
              plain
              dimColor
              onPress={() => update($, panelAtom, now => ({ ...now, isJsonShown: !now.isJsonShown }))}
            />
          </Box>
          {panel.isJsonShown && <Code source={toJson(chosen)} language="json" />}
        </Box>

        <Box flexDirection="column" gap={1}>
          <Text bold>The sea</Text>
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Box width={12}>
              <Text>Backdrop</Text>
            </Box>
            {backdrop('moving', 'Moving')}
            {backdrop('still', 'Still')}
            {backdrop('plain', 'Plain')}
          </Box>
          {!isSea && <Text dimColor>Plain is the scheme's background alone: no sea, no shark, no glass.</Text>}
          <Box gap={1} alignItems="center" flexWrap="wrap" display={isSea ? 'flex' : 'none'}>
            <Box width={12}>
              <Text>Glass</Text>
            </Box>
            {glass('off', 'Off')}
            {glass('clear', 'Clear')}
            {glass('standard', 'Standard')}
            {glass('frosted', 'Frosted')}
          </Box>
          <Box gap={1} alignItems="center" display={isSea ? 'flex' : 'none'}>
            <Box width={12}>
              <Text>Waves</Text>
            </Box>
            <Button
              key="hammerhead:waves-down"
              label="Fewer waves"
              onPress={() => change($, now => ({ ...now, waves: Math.max(3, now.waves - 2) }), '')}
            />
            <Box width={6} justifyContent="center">
              <Text tabular>{String(settings.waves)}</Text>
            </Box>
            <Button
              key="hammerhead:waves-up"
              label="More waves"
              onPress={() => change($, now => ({ ...now, waves: Math.min(7, now.waves + 2) }), '')}
            />
            {toggle('glints', settings.hasGlints ? 'Glints on' : 'Glints off', settings.hasGlints, now => ({ ...now, hasGlints: !now.hasGlints }))}
          </Box>
          <Box gap={1} alignItems="center" display={isSea ? 'flex' : 'none'}>
            <Box width={12}>
              <Text>Shark</Text>
            </Box>
            <Button
              key="hammerhead:shark"
              label={settings.isSharkShown ? 'Shown' : 'Hidden'}
              variant={settings.isSharkShown ? 'primary' : 'secondary'}
              onPress={() => change($, now => ({ ...now, isSharkShown: !now.isSharkShown }), '')}
            />
            <Button
              key="hammerhead:route"
              label="New route"
              onPress={() => {
                seed = Math.floor(Math.random() * 2147483646)

                return change($, now => now, 'The shark took a new route.')
              }}
            />
          </Box>
          {isSea && stepper('size', 'Shark size', 'Smaller', 'Larger')}
          {isSea && stepper('speed', 'Swim speed', 'Slower', 'Faster')}
        </Box>

        <Box flexDirection="column" gap={1}>
          <Text bold>The app</Text>
          <Box gap={1} alignItems="center">
            <Box width={12}>
              <Text>Contrast</Text>
            </Box>
            {toggle('contrast', 'Stronger borders', settings.isHighContrast, now => ({ ...now, isHighContrast: !now.isHighContrast }))}
          </Box>
        </Box>

        <Box>
          <Button
            key="hammerhead:reset"
            label="Reset to defaults"
            plain
            dimColor
            onPress={() => change($, now => ({ ...DEFAULT_LOOK, custom: now.custom }), 'Back to the defaults. Your own schemes are kept.')}
          />
        </Box>
      </Box>
    )
  })
}
