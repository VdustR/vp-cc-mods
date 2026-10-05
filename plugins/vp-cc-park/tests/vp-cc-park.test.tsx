import { expect, mock, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const ROOT = '/work/app'

type On = Parameters<Parameters<typeof test>[1]>[1]

// Stand in for the engine: its band, clock, store, project root and toasts.
const engine = (on: On, entries: Record<string, unknown> = {}) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on, entries)
  on('session.root', () => ({ value: ROOT }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  return toasts
}

// Record what the mod puts in the prompt box.
const promptBox = (on: On) => {
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  return filled
}

const drawn = async (band: { drawn: () => Promise<unknown> }) => JSON.stringify(await band.drawn())

test('/vp-cc-park parks an idea quietly, and Start puts it back in the prompt', async ($, on) => {
  const toasts = engine(on)
  const filled = promptBox(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-park', surface, ...BAND })
    expect(await drawn(band)).not.toContain('parked')

    const answer = await $.command.run({ command: 'vp-cc-park', args: '  Write the timebox README  ' })
    expect(answer.text).toBeUndefined()
    expect(toasts.at(-1)).toBe('Parked: Write the timebox README')

    const collapsed = await drawn(band)
    expect(collapsed).toContain('🅿 1 parked')
    expect(collapsed).not.toContain('Write the timebox README')
    expect(collapsed).toContain('engine band')

    await band.press({ key: 'park:toggle' })
    expect(await drawn(band)).toContain('Write the timebox README')

    const start = await band.find({ type: 'Button', text: 'Start' })
    expect(start?.key).toBeDefined()
    await band.press({ key: start?.key ?? '' })
    expect(filled.at(-1)).toBe('Write the timebox README')
    expect(await drawn(band)).not.toContain('parked')
    // Read back from the store: the idea is gone there too.
    await $.command.run({ command: 'vp-cc-park', args: '' })
    expect(await drawn(band)).toContain('Nothing parked here')
    await $.command.run({ command: 'vp-cc-park', args: '' })
    await band.unmount()
  }
})

test('Remove unparks an idea without touching the prompt', async ($, on) => {
  engine(on)
  const filled = promptBox(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-park', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-park', args: 'Rename the branch' })
    await $.command.run({ command: 'vp-cc-park', args: '' })
    const remove = await band.find({ type: 'Button', text: 'Remove' })
    await band.press({ key: remove?.key ?? '' })
    expect(filled).toEqual([])
    expect(await drawn(band)).toContain('Nothing parked here')
    await $.command.run({ command: 'vp-cc-park', args: '' })
    await band.unmount()
  }
})

test("another project's ideas are listed apart and never counted here", async ($, on) => {
  engine(on, {
    'item:other': { id: 'other', text: 'Fix the flaky test', at: 5, project: '/work/site' },
    'item:here': { id: 'here', text: 'Tidy the band', at: 6, project: ROOT },
  })

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-park', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-park', args: '' })
    await $.command.run({ command: 'vp-cc-park', args: '' })
    expect(await drawn(band)).toContain('🅿 1 parked')

    await $.command.run({ command: 'vp-cc-park', args: '' })
    const open = await drawn(band)
    expect(open).toContain('Tidy the band')
    expect(open).not.toContain('Tidy the band (app)')
    expect(open).toContain('Other projects')
    expect(open).toContain('Fix the flaky test')
    expect(open).toContain('(site)')
    await $.command.run({ command: 'vp-cc-park', args: '' })
    await band.unmount()
  }
})

test('with showCount off, the band stays empty until the list is asked for', { options: { showCount: false } }, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-park', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-park', args: `Idea on ${surface}` })
    expect(await drawn(band)).not.toContain('parked')
    await $.command.run({ command: 'vp-cc-park', args: '' })
    expect(await drawn(band)).toContain(`Idea on ${surface}`)
    await $.command.run({ command: 'vp-cc-park', args: '' })
    await band.unmount()
  }
})

test('labels follow the language of the prompts, and a label that drops its placeholder keeps the default', async ($, on) => {
  const toasts = engine(on)
  const asked: string[] = []
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('model.complete', (_$, e) => {
    asked.push(e.prompt)
    return {
      value: {
        isAnswered: true,
        text: JSON.stringify({ count: '🅿 {n} geparkt', show: 'Zeigen', parked: 'Geparkt' }),
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    }
  })

  await $.prompt.submit({ text: 'Bitte schreib zuerst die Tests' })
  await $.prompt.submit({ text: '/vp-cc-park' })
  await $.command.run({ command: 'vp-cc-park', args: 'Die Doku aktualisieren' })
  expect(asked).toHaveLength(1)
  expect(asked[0]).toContain('Bitte schreib zuerst die Tests')

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-park', surface, ...BAND })
    const tree = await drawn(band)
    expect(tree).toContain('🅿 1 geparkt')
    expect(tree).toContain('Zeigen')
    await band.unmount()
  }

  await $.command.run({ command: 'vp-cc-park', args: 'Noch eine Idee' })
  expect(toasts.at(-1)).toBe('Parked: Noch eine Idee')
  expect(asked).toHaveLength(1)
})
