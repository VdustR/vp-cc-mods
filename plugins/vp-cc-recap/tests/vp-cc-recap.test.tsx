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

// Stand in for the engine's own band and clock.
const engineBand = (on: Parameters<Parameters<typeof test>[1]>[1]) => {
  mock.clock(on, { now: 1_000_000 })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
}

test('/vp-cc-recap leads with the next step and fills it into the prompt', async ($, on) => {
  engineBand(on)
  const reply = JSON.stringify({
    next: '把 recap 搬到 ~/mods',
    next_by: 'claude',
    goal: '做 ADHD 友善的 recap',
    done: ['改成先講下一步', '加上詳細切換'],
  })
  on('model.fork', () => ({ value: { isAnswered: true, text: reply, usage: USAGE } }))
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    const answer = await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(answer.text).toBeUndefined()

    const compact = JSON.stringify(await band.drawn())
    expect(compact).toContain('⏭ 交給 Claude')
    expect(compact).toContain('把 recap 搬到 ~/mods')
    expect(compact).not.toContain('改成先講下一步')

    await band.press({ key: 'more' })
    expect(JSON.stringify(await band.drawn())).toContain('改成先講下一步')

    await band.press({ key: 'start' })
    expect(filled.at(-1)).toBe('把 recap 搬到 ~/mods')
    expect(await band.find({ type: 'Text', text: /engine band/ })).toBeDefined()
    await band.unmount()
  }
})

test("the person's own step reports back instead of prompting Claude", async ($, on) => {
  engineBand(on)
  const reply = JSON.stringify({ next: '在 Desktop 按 1 試試', next_by: 'user', goal: '驗證 recap', done: [] })
  on('model.fork', () => ({ value: { isAnswered: true, text: reply, usage: USAGE } }))
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    const tree = JSON.stringify(await band.drawn())
    expect(tree).toContain('⏭ 你的下一步')
    expect(tree).toContain('做完了')
    await band.press({ key: 'start' })
    expect(filled.at(-1)).toBe('我做完了：在 Desktop 按 1 試試')
    await band.unmount()
  }
})

test('a waiting decision outranks the next step', async ($, on) => {
  engineBand(on)
  const reply = JSON.stringify({ next: '寫測試', waiting: '要不要刪掉舊版？', goal: '整理 mod', done: [] })
  on('model.fork', () => ({ value: { isAnswered: true, text: reply, usage: USAGE } }))

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    const tree = JSON.stringify(await band.drawn())
    expect(tree).toContain('⚠ 等你決定')
    expect(tree).toContain('要不要刪掉舊版？')
    expect((await band.find({ key: 'start' }))?.text ?? tree).toContain('回覆')
    await band.press({ key: 'dismiss' })
    await band.unmount()
  }
})

test('a reply that is not JSON still shows as markdown', async ($, on) => {
  engineBand(on)
  on('model.fork', () => ({ value: { isAnswered: true, text: '**下一步**：看看', usage: USAGE } }))

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(JSON.stringify(await band.drawn())).toContain('看看')
    await band.press({ key: 'dismiss' })
    await band.unmount()
  }
})

test('/vp-cc-recap explains when there is nothing to recap yet', async ($, on) => {
  engineBand(on)
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'nothing-to-fork' } }))

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: 'vp-cc-recap', surface, ...BAND })
    await $.command.run({ command: 'vp-cc-recap', args: '' })
    expect(JSON.stringify(await band.drawn())).toContain('還沒有可以整理的內容')
    await band.press({ key: 'dismiss' })
    await band.unmount()
  }
})
