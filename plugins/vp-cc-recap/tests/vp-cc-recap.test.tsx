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

const USAGE = { inputTokens: 1, outputTokens: 1 }

type On = Parameters<Parameters<typeof test>[1]>[1]

// Stand in for the engine's own band and clock.
const engineBand = (on: On) => {
  mock.clock(on, { now: 1_000_000 })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
}

// Answer the fork with `reply()` at call time, so a test can change it.
const forkReplies = (on: On, reply: () => object) =>
  on('model.fork', () => ({ value: reply() }))

const answered = (body: object | string) => ({
  isAnswered: true,
  text: typeof body === 'string' ? body : JSON.stringify(body),
  usage: USAGE,
})

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

test('/vp-cc-recap leads with the next step and fills it into the prompt', async ($, on) => {
  engineBand(on)
  forkReplies(on, () =>
    answered({
      next: 'Move the plugin into the repo',
      next_by: 'claude',
      goal: 'Ship an ADHD-friendly recap',
      done: ['Put the next step first', 'Add a details toggle'],
    }),
  )
  const filled = promptBox(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    const answer = await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(answer.text).toBeUndefined()

    const compact = await drawn(band)
    expect(compact).toContain('⏭ Hand to Claude')
    expect(compact).toContain('Move the plugin into the repo')
    expect(compact).not.toContain('Put the next step first')
    // The band stacks above what the other plugins and the engine draw.
    expect(compact).toContain('engine band')

    await band.press({ key: 'more' })
    expect(await drawn(band)).toContain('Put the next step first')

    await band.press({ key: 'start' })
    expect(filled.at(-1)).toBe('Move the plugin into the repo')
    expect(await band.find({ type: 'Text', text: /engine band/ })).toBeDefined()
    await band.unmount()
  }
})

test("the person's own step reports back instead of prompting Claude", async ($, on) => {
  engineBand(on)
  forkReplies(on, () =>
    answered({ next: 'Try it in the Desktop app', next_by: 'user', goal: 'Verify the recap', done: [] }),
  )
  const filled = promptBox(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    const tree = await drawn(band)
    expect(tree).toContain('⏭ Your next step')
    expect(tree).toContain('Done')
    await band.press({ key: 'start' })
    expect(filled.at(-1)).toBe('I finished: Try it in the Desktop app')
    await band.unmount()
  }
})

test('a waiting decision outranks the next step', async ($, on) => {
  engineBand(on)
  forkReplies(on, () =>
    answered({ next: 'Write the tests', waiting: 'Delete the old version?', goal: 'Tidy the mods', done: [] }),
  )
  const filled = promptBox(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    const tree = await drawn(band)
    expect(tree).toContain('⚠ Waiting on you')
    expect(tree).toContain('Delete the old version?')
    expect(tree).toContain('Reply')
    await band.press({ key: 'start' })
    expect(filled.at(-1)).toBe('About "Delete the old version?": ')
    await band.unmount()
  }
})

test('labels follow the model, and a label that drops its placeholder keeps the default', async ($, on) => {
  engineBand(on)
  let reply: object = answered({
    next: 'Try it in the Desktop app',
    next_by: 'user',
    goal: 'Verify the recap',
    done: [],
    ui: {
      yourStep: 'Over to you',
      done: 'Finished it',
      doneFill: 'All set',
      nothingYet: 'No session history to recap',
    },
  })
  forkReplies(on, () => reply)
  const filled = promptBox(on)

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    const tree = await drawn(band)
    expect(tree).toContain('⏭ Over to you')
    expect(tree).toContain('Finished it')
    expect(tree).toContain('Details')

    await band.press({ key: 'start' })
    expect(filled.at(-1)).toBe('I finished: Try it in the Desktop app')

    // A later state drawn without a fresh reply keeps the model's language.
    const previous = reply
    reply = { isAnswered: false, reason: 'nothing-to-fork' }
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(await drawn(band)).toContain('No session history to recap')
    reply = previous
    await band.press({ key: 'dismiss' })
    await band.unmount()
  }
})

test('a reply that is not JSON still shows as markdown', async ($, on) => {
  engineBand(on)
  forkReplies(on, () => answered('**Next step**: take a look'))

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(await drawn(band)).toContain('take a look')
    await band.press({ key: 'dismiss' })
    await band.unmount()
  }
})

test('/vp-cc-recap explains when there is nothing to recap yet', async ($, on) => {
  engineBand(on)
  forkReplies(on, () => ({ isAnswered: false, reason: 'nothing-to-fork' }))

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(await drawn(band)).toContain('Nothing to recap in this session yet')
    await band.press({ key: 'dismiss' })
    await band.unmount()
  }
})
