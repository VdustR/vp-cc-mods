import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ParkItem, ParkLabels } from '../types'
import { addSample, fill, labelsPrompt, parseLabels } from './localize'

// English defaults. A small model translates them into the person's language
// once per session; a missing or malformed label keeps its default.
const DEFAULT_LABELS: ParkLabels = {
  parked: 'Parked: {text}',
  count: '🅿 {n} parked',
  show: 'Show',
  hide: 'Hide',
  start: 'Start',
  remove: 'Remove',
  otherProjects: 'Other projects',
  more: '…and {n} more',
  empty: 'Nothing parked here. Add an idea with /vp-cc-park <idea>',
  fillFailed: 'Could not fill the prompt box; copy the idea yourself',
}

const MAX_ITEMS = 100
const MAX_LENGTH = 500
const LIST_ROWS = 6

const items = atom({ plugin: 'vp-cc-park', key: 'items' } as const, [])
const isOpen = atom({ plugin: 'vp-cc-park', key: 'isOpen' } as const, false)
const labels = atom({ plugin: 'vp-cc-park', key: 'labels' } as const, DEFAULT_LABELS)
const project = atom({ plugin: 'vp-cc-park', key: 'project' } as const, '')

const isItem = (value: unknown): value is ParkItem => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.at === 'number' &&
    typeof item.project === 'string'
  )
}

const baseName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

const ITEM_KEY = 'item:'

// Every session on the machine shares the store, and a read followed by a
// write is not atomic, so each idea lives under its own key: sessions that
// park or unpark different ideas never overwrite each other.

/** This session's project root, read once and kept in state. */
async function projectRoot($: EngineInterface): Promise<string> {
  const known = await read($, project)
  if (known !== '') return known
  const root = await $.session.root()
  await update($, project, () => root)
  return root
}

/** Reads every idea from the store, oldest first, into this session's copy. */
async function refreshItems($: EngineInterface): Promise<ParkItem[]> {
  await projectRoot($)
  const keys = (await $.store.keys()).filter(key => key.startsWith(ITEM_KEY))
  const list: ParkItem[] = []
  for (const key of keys) {
    const value = await $.store.get(key)
    if (isItem(value)) list.push(value)
  }
  list.sort((a, b) => a.at - b.at)
  await update($, items, () => list)
  return list
}

async function addItem($: EngineInterface, item: ParkItem) {
  await $.store.set(ITEM_KEY + item.id, item)
  const list = await refreshItems($)
  const excess = list.slice(0, Math.max(0, list.length - MAX_ITEMS))
  for (const old of excess) await $.store.delete(ITEM_KEY + old.id)
  if (excess.length > 0) await refreshItems($)
}

async function removeItem($: EngineInterface, id: string) {
  await $.store.delete(ITEM_KEY + id)
  await refreshItems($)
}

/** Puts the idea in the prompt box without overwriting a draft, then unparks it. */
async function startItem($: EngineInterface, item: ParkItem, fillFailed: string) {
  const box = await $.prompt.read()
  const filled = await $.prompt.fill(
    box.text.trim() === '' ? { text: item.text } : { text: `\n${item.text}`, mode: 'append' },
  )
  if (!filled.isFilled) {
    $.ui.toast(`vp-cc-park: ${fillFailed}`)
    return
  }
  await removeItem($, item.id)
  await update($, isOpen, () => false)
}

/** Asks a small model for the labels in the language of `samples`, and keeps them. */
async function translateLabels($: EngineInterface, samples: readonly string[]) {
  const reply = await $.model.complete({
    model: 'haiku',
    prompt: labelsPrompt(DEFAULT_LABELS, samples),
    effort: 'low',
    timeoutMs: 20_000,
  })
  if (!reply.isAnswered) return
  const translated = parseLabels(reply.text, DEFAULT_LABELS)
  await update($, labels, () => translated)
  await $.store.set('labels', translated)
}

export const register: Register = (on, options) => {
  const showCount = options.showCount !== false
  let samples: string[] = []
  let isTranslated = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'vp-cc-park',
      description: 'Park a side idea for later, or show the parked ideas',
      argumentHint: '[idea]',
      immediate: true,
    })
    await refreshItems($)
    // Start in the language of the last session until this one is translated.
    const stored = parseLabels(await $.store.get('labels'), DEFAULT_LABELS)
    await update($, labels, () => stored)

    return next(e)
  })

  // Nothing in the transcript and nothing for the model: parking is meant to
  // leave the current task undisturbed.
  on('command.run', { command: 'vp-cc-park' }, async ($, e) => {
    if (!isTranslated && samples.length > 0) {
      isTranslated = true
      // A refused request rejects; English labels stay in that case.
      void translateLabels($, samples).catch(() => undefined)
    }
    const text = e.args.trim().slice(0, MAX_LENGTH)
    if (text === '') {
      await refreshItems($)
      await update($, isOpen, value => !value)
      return {}
    }
    const at = await $.clock.now()
    const item: ParkItem = {
      id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      at,
      project: await projectRoot($),
    }
    await addItem($, item)
    $.ui.toast(fill((await read($, labels)).parked, { text }))

    return {}
  })

  // The person's own prompts are the language sample for the labels.
  on('prompt.submit', async ($, e, next) => {
    const entered = await next(e)
    // An origin is always stamped in a session; a test's own submit has none.
    const isPerson =
      e.origin === undefined ||
      e.origin.kind === 'composer' ||
      e.origin.kind === 'bridge' ||
      (e.origin.kind === 'plugin' && e.origin.asUser === true)
    if (isPerson) samples = addSample(samples, e.text)

    return entered
  })

  // Another session may have parked or unparked something meanwhile.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await refreshItems($)

    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const all = await read($, items)
    const root = await read($, project)
    const here = all.filter(item => item.project === root).reverse()
    const elsewhere = all.filter(item => item.project !== root).reverse()
    const open = await read($, isOpen)
    if (!open && (!showCount || here.length === 0)) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const text = await read($, labels)
    // The band is shared: draw above what the other plugins and the engine draw.
    const stack = (tree: JSX.Element) => (
      <Box flexDirection="column">
        {tree}
        {below}
      </Box>
    )
    const toggle = (
      <Button
        key="park:toggle"
        label={open ? text.hide : text.show}
        hotkey="p"
        plain
        dimColor
        onPress={() => update($, isOpen, value => !value)}
      />
    )

    if (!open) {
      return stack(
        <Box gap={2}>
          <Text dimColor>{fill(text.count, { n: here.length })}</Text>
          {toggle}
        </Box>,
      )
    }

    const row = (item: ParkItem, isHere: boolean) => (
      <Box key={`park:row:${item.id}`} gap={2}>
        <Text dimColor={!isHere}>
          • {item.text}
          {isHere ? '' : ` (${baseName(item.project)})`}
        </Text>
        <Button
          key={`park:start:${item.id}`}
          label={text.start}
          plain
          onPress={() => startItem($, item, text.fillFailed)}
        />
        <Button
          key={`park:remove:${item.id}`}
          label={text.remove}
          plain
          dimColor
          onPress={() => removeItem($, item.id)}
        />
      </Box>
    )
    const shownHere = here.slice(0, LIST_ROWS)
    const shownElsewhere = elsewhere.slice(0, Math.max(0, LIST_ROWS - shownHere.length))
    const hidden = here.length + elsewhere.length - shownHere.length - shownElsewhere.length

    return stack(
      <Box flexDirection="column">
        <Box gap={2}>
          <Text bold>{fill(text.count, { n: here.length })}</Text>
          {toggle}
        </Box>
        {here.length === 0 && <Text dimColor>{text.empty}</Text>}
        {shownHere.map(item => row(item, true))}
        {shownElsewhere.length > 0 && <Text dimColor>{text.otherProjects}</Text>}
        {shownElsewhere.map(item => row(item, false))}
        {hidden > 0 && <Text dimColor>{fill(text.more, { n: hidden })}</Text>}
      </Box>,
    )
  })
}
