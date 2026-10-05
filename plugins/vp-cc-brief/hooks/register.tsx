import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { BriefContent, BriefTrigger, BriefView } from '../types'

const HIDDEN: BriefView = { phase: 'hidden' }
const view = atom({ plugin: 'vp-cc-brief', key: 'view' } as const, HIDDEN)
const isExpanded = atom({ plugin: 'vp-cc-brief', key: 'isExpanded' } as const, false)

// The one user message the fork answers. It reads the whole session from the
// main thread's cached prefix, so only this message and the reply are new.
const BRIEF_PROMPT = `The user is coming back to this session after a break and has trouble holding context (ADHD). Write a recap that gets them moving again.

Reply with one JSON object and nothing else, no code fence:
{"next": "...", "next_by": "claude", "waiting": "...", "goal": "...", "done": ["..."]}

- next: exactly one concrete next step, at most 40 characters.
- next_by: "claude" when the step is work for you, written as an instruction the user could send you; "user" when the user does it themselves (try, check, decide, run something), written as an instruction to the user.
- waiting: only when you are blocked on the user's decision or approval, the question in at most 40 characters; otherwise omit the key.
- goal: what this session is working toward, one sentence, at most 40 characters.
- done: at most 3 finished items, each at most 25 characters, newest first.

Write in Traditional Chinese. State outcomes, not process. No tool names, file paths or ids unless the next step needs one.`

const asText = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

function parseBrief(reply: string): BriefContent | undefined {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    const data: unknown = JSON.parse(reply.slice(start, end + 1))
    if (typeof data !== 'object' || data === null) return undefined
    const fields = data as Record<string, unknown>
    const next = asText(fields.next, 120)
    const goal = asText(fields.goal, 120)
    if (next === '' || goal === '') return undefined
    const nextBy = fields.next_by === 'user' ? 'user' : 'claude'
    const waiting = asText(fields.waiting, 120)
    const done = Array.isArray(fields.done)
      ? fields.done.map(item => asText(item, 80)).filter(item => item !== '').slice(0, 3)
      : []
    return waiting === '' ? { next, nextBy, goal, done } : { next, nextBy, waiting, goal, done }
  } catch {
    return undefined
  }
}

async function makeBrief($: EngineInterface, trigger: BriefTrigger, lastTurnAt: number | undefined) {
  await update($, view, () => ({ phase: 'generating', trigger }))
  await update($, isExpanded, () => false)
  const reply = await $.model.fork({ prompt: BRIEF_PROMPT })
  if (reply.isAnswered && reply.text.trim() !== '') {
    const raw = reply.text.trim()
    const content = parseBrief(raw)
    await update($, view, () => ({ phase: 'shown', trigger, raw, content, lastTurnAt }))
    return
  }
  if (!reply.isAnswered && reply.reason === 'nothing-to-fork') {
    await update($, view, () =>
      trigger === 'manual'
        ? { phase: 'error', trigger, reason: '這個 session 還沒有可以整理的內容' }
        : HIDDEN,
    )
    return
  }
  const reason = reply.isAnswered ? 'empty-reply' : reply.reason
  await update($, view, () =>
    trigger === 'manual' ? { phase: 'error', trigger, reason: `整理失敗（${reason}）` } : HIDDEN,
  )
}

/** Puts the next step in the prompt box without overwriting a draft, then hides the band. */
async function startNext($: EngineInterface, text: string) {
  const box = await $.prompt.read()
  const filled = await $.prompt.fill(
    box.text.trim() === '' ? { text } : { text: `\n${text}`, mode: 'append' },
  )
  if (!filled.isFilled) {
    $.ui.toast('vp-cc-brief: 輸入框暫時不能填入，請手動輸入下一步')
    return
  }
  await update($, view, () => HIDDEN)
}

const minutesAgo = (now: number, at: number | undefined) =>
  at === undefined ? undefined : Math.max(0, Math.round((now - at) / 60_000))

export const register: Register = (on, options) => {
  const idleMinutes = Math.max(0, Number(options.idleMinutes ?? 5))
  let idleTimer: Timer | undefined
  let isGenerating = false
  let lastTurnAt: number | undefined

  const stopIdleTimer = () => {
    idleTimer?.cancel()
    idleTimer = undefined
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'vp-cc-brief',
      description: 'Show where this session stands and the one next step, above the prompt',
    })

    return next(e)
  })

  // No transcript line: the band is the answer, and nothing reaches the model.
  on('command.run', { command: 'vp-cc-brief' }, async $ => {
    stopIdleTimer()
    if (!isGenerating) {
      isGenerating = true
      try {
        await makeBrief($, 'manual', lastTurnAt)
      } finally {
        isGenerating = false
      }
    }

    return {}
  })

  // New work makes a shown brief stale: hide it, then prepare a fresh one once
  // the person has been idle for `idleMinutes`.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) {
      return done
    }
    lastTurnAt = await $.clock.now()
    const current = await read($, view)
    if (current.phase === 'shown' || current.phase === 'error') {
      await update($, view, () => HIDDEN)
    }
    stopIdleTimer()
    if (idleMinutes > 0) {
      idleTimer = $.clock.after(idleMinutes * 60_000, () => {
        idleTimer = undefined
        if (isGenerating) return
        isGenerating = true
        void makeBrief($, 'idle', lastTurnAt).finally(() => {
          isGenerating = false
        })
      })
    }

    return done
  })

  // The person is back and acting: drop the timer and the brief.
  on('prompt.submit', async ($, e, next) => {
    stopIdleTimer()
    const current = await read($, view)
    if (current.phase === 'shown' || current.phase === 'error') {
      await update($, view, () => HIDDEN)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, view)
    if (current.phase === 'hidden' || e.props.hasSurvey) {
      return next(e)
    }
    // An idle brief prepares quietly; only one the person asked for shows progress.
    if (current.phase === 'generating' && current.trigger === 'idle') {
      return next(e)
    }

    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const hide = () => update($, view, () => HIDDEN)

    if (current.phase === 'generating') {
      return (
        <Box>
          <Text dimColor>⏳ 正在整理進度…</Text>
        </Box>
      )
    }

    if (current.phase === 'error') {
      return (
        <Box gap={2}>
          <Text dimColor>{current.reason}</Text>
          <Button key="dismiss" label="收起" hotkey="3" plain dimColor onPress={hide} />
        </Box>
      )
    }

    const content = current.content
    const expanded = await read($, isExpanded)
    const ago = minutesAgo(await $.clock.now(), current.lastTurnAt)
    const footer = ago === undefined ? '' : ago === 0 ? '上次回覆是剛剛' : `上次回覆是 ${ago} 分鐘前`

    if (content === undefined) {
      return (
        <Box flexDirection="column">
          <Markdown text={current.raw.slice(0, 10_000)} />
          <Button key="dismiss" label="收起" hotkey="3" plain dimColor onPress={hide} />
        </Box>
      )
    }

    // The one thing to do comes first; a waiting decision outranks the next step.
    // The primary button fits who acts: a prompt for Claude, a report back
    // after the person's own step, or an answer to the waiting question.
    const primary =
      content.waiting !== undefined
        ? { label: '⚠ 等你決定', text: content.waiting, button: '回覆', fill: `關於「${content.waiting}」：` }
        : content.nextBy === 'user'
          ? { label: '⏭ 你的下一步', text: content.next, button: '做完了', fill: `我做完了：${content.next}` }
          : { label: '⏭ 交給 Claude', text: content.next, button: '開始', fill: content.next }

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>{primary.label}：</Text>
          <Text bold>{primary.text}</Text>
        </Text>
        <Text dimColor>🎯 {content.goal}</Text>
        {expanded && content.waiting !== undefined && (
          <Text dimColor>⏭ 之後：{content.next}</Text>
        )}
        {expanded &&
          content.done.map(item => (
            <Text dimColor>✅ {item}</Text>
          ))}
        <Box gap={2}>
          <Button
            key="start"
            label={primary.button}
            hotkey="1"
            plain
            onPress={() => startNext($, primary.fill)}
          />
          <Button
            key="more"
            label={expanded ? '精簡' : '詳細'}
            hotkey="2"
            plain
            dimColor
            onPress={() => update($, isExpanded, value => !value)}
          />
          <Button key="dismiss" label="收起" hotkey="3" plain dimColor onPress={hide} />
          {footer !== '' && <Text dimColor>{footer}</Text>}
        </Box>
      </Box>
    )
  })
}
