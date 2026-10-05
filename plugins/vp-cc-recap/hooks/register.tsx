import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { RecapContent, RecapLabels, RecapTrigger, RecapView } from '../types'

const HIDDEN: RecapView = { phase: 'hidden' }

// English defaults. The model sends these back translated into the user's
// language with each recap; a missing or malformed label keeps its default.
const DEFAULT_LABELS: RecapLabels = {
  handToClaude: 'Hand to Claude',
  yourStep: 'Your next step',
  waiting: 'Waiting on you',
  then: 'Then',
  start: 'Start',
  done: 'Done',
  reply: 'Reply',
  details: 'Details',
  less: 'Less',
  dismiss: 'Dismiss',
  lastReplyJustNow: 'Last reply just now',
  lastReplyMinutesAgo: 'Last reply {n} min ago',
  doneFill: 'I finished: {step}',
  replyFill: 'About "{question}": ',
  preparing: 'Preparing recap…',
  nothingYet: 'Nothing to recap in this session yet',
  failed: 'Recap failed',
  fillFailed: 'Could not fill the prompt box; type the next step yourself',
}

// Placeholders a label must keep, so a translation cannot drop the value.
const REQUIRED_PLACEHOLDERS: Partial<Record<keyof RecapLabels, string>> = {
  lastReplyMinutesAgo: '{n}',
  doneFill: '{step}',
  replyFill: '{question}',
}

const view = atom({ plugin: 'vp-cc-recap', key: 'view' } as const, HIDDEN)
const isExpanded = atom({ plugin: 'vp-cc-recap', key: 'isExpanded' } as const, false)
const labels = atom({ plugin: 'vp-cc-recap', key: 'labels' } as const, DEFAULT_LABELS)

// The one user message the fork answers. It reads the whole session from the
// main thread's cached prefix, so only this message and the reply are new.
const RECAP_PROMPT = `The user is coming back to this session after a break and has trouble holding context (ADHD). Write a recap that gets them moving again.

Reply with one JSON object and nothing else, no code fence:
{"next": "...", "next_by": "claude", "waiting": "...", "goal": "...", "done": ["..."], "ui": ${JSON.stringify(DEFAULT_LABELS)}}

- next: exactly one concrete next step, one short phrase.
- next_by: "claude" when the step is work for you, written as an instruction the user could send you; "user" when the user does it themselves (try, check, decide, run something), written as an instruction to the user.
- waiting: only when you are blocked on the user's decision or approval, the question as one short phrase; otherwise omit the key.
- goal: what this session is working toward, one short sentence.
- done: at most 3 finished items, each a few words, newest first.
- ui: the interface labels above, translated into the user's language. Keep every {placeholder} exactly as written. Keep them as short as the English.

Language: write every value, ui labels included, in the language the user has mostly written in during this session. State outcomes, not process. No tool names, file paths or ids unless the next step needs one.`

const asText = (value: unknown, limit: number) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

function parseLabels(value: unknown): RecapLabels {
  if (typeof value !== 'object' || value === null) return DEFAULT_LABELS
  const given = value as Record<string, unknown>
  const result: RecapLabels = { ...DEFAULT_LABELS }
  for (const key of Object.keys(DEFAULT_LABELS) as (keyof RecapLabels)[]) {
    const text = typeof given[key] === 'string' ? (given[key] as string).slice(0, 80) : ''
    const placeholder = REQUIRED_PLACEHOLDERS[key]
    if (text.trim() !== '' && (placeholder === undefined || text.includes(placeholder))) {
      result[key] = text
    }
  }
  return result
}

function parseRecap(reply: string): { content: RecapContent; labels: RecapLabels } | undefined {
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
    const content: RecapContent =
      waiting === '' ? { next, nextBy, goal, done } : { next, nextBy, waiting, goal, done }
    return { content, labels: parseLabels(fields.ui) }
  } catch {
    return undefined
  }
}

async function makeRecap($: EngineInterface, trigger: RecapTrigger, lastTurnAt: number | undefined) {
  await update($, view, () => ({ phase: 'generating', trigger }))
  await update($, isExpanded, () => false)
  const reply = await $.model.fork({ prompt: RECAP_PROMPT })
  if (reply.isAnswered && reply.text.trim() !== '') {
    const raw = reply.text.trim()
    const parsed = parseRecap(raw)
    if (parsed !== undefined) {
      await update($, labels, () => parsed.labels)
    }
    await update($, view, () => ({ phase: 'shown', trigger, raw, content: parsed?.content, lastTurnAt }))
    return
  }
  if (!reply.isAnswered && reply.reason === 'nothing-to-fork') {
    await update($, view, () =>
      trigger === 'manual' ? { phase: 'error', trigger, reason: 'nothing-yet' } : HIDDEN,
    )
    return
  }
  const detail = reply.isAnswered ? 'empty-reply' : reply.reason
  await update($, view, () =>
    trigger === 'manual' ? { phase: 'error', trigger, reason: 'failed', detail } : HIDDEN,
  )
}

/** Puts the next step in the prompt box without overwriting a draft, then hides the band. */
async function startNext($: EngineInterface, text: string, fillFailed: string) {
  const box = await $.prompt.read()
  const filled = await $.prompt.fill(
    box.text.trim() === '' ? { text } : { text: `\n${text}`, mode: 'append' },
  )
  if (!filled.isFilled) {
    $.ui.toast(`vp-cc-recap: ${fillFailed}`)
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
      name: 'vp-cc-recap',
      description: 'Show where this session stands and the one next step, above the prompt',
    })

    return next(e)
  })

  // No transcript line: the band is the answer, and nothing reaches the model.
  on('command.run', { command: 'vp-cc-recap' }, async $ => {
    stopIdleTimer()
    if (!isGenerating) {
      isGenerating = true
      try {
        await makeRecap($, 'manual', lastTurnAt)
      } finally {
        isGenerating = false
      }
    }

    return {}
  })

  // New work makes a shown recap stale: hide it, then prepare a fresh one once
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
        void makeRecap($, 'idle', lastTurnAt).finally(() => {
          isGenerating = false
        })
      })
    }

    return done
  })

  // The person is back and acting: drop the timer and the recap.
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
    // An idle recap prepares quietly; only one the person asked for shows progress.
    if (current.phase === 'generating' && current.trigger === 'idle') {
      return next(e)
    }

    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const text = await read($, labels)
    const hide = () => update($, view, () => HIDDEN)
    const dismiss = <Button key="dismiss" label={text.dismiss} hotkey="3" plain dimColor onPress={hide} />

    if (current.phase === 'generating') {
      return (
        <Box>
          <Text dimColor>⏳ {text.preparing}</Text>
        </Box>
      )
    }

    if (current.phase === 'error') {
      const message =
        current.reason === 'nothing-yet' ? text.nothingYet : `${text.failed} (${current.detail ?? 'unknown'})`
      return (
        <Box gap={2}>
          <Text dimColor>{message}</Text>
          {dismiss}
        </Box>
      )
    }

    const content = current.content
    const expanded = await read($, isExpanded)
    const ago = minutesAgo(await $.clock.now(), current.lastTurnAt)
    const footer =
      ago === undefined ? '' : ago === 0 ? text.lastReplyJustNow : text.lastReplyMinutesAgo.replace('{n}', () => String(ago))

    if (content === undefined) {
      return (
        <Box flexDirection="column">
          <Markdown text={current.raw.slice(0, 10_000)} />
          {dismiss}
        </Box>
      )
    }

    // The one thing to do comes first; a waiting decision outranks the next step.
    // The primary button fits who acts: a prompt for Claude, a report back
    // after the person's own step, or an answer to the waiting question.
    const primary =
      content.waiting !== undefined
        ? {
            label: `⚠ ${text.waiting}`,
            text: content.waiting,
            button: text.reply,
            fill: text.replyFill.replace('{question}', () => content.waiting ?? ''),
          }
        : content.nextBy === 'user'
          ? {
              label: `⏭ ${text.yourStep}`,
              text: content.next,
              button: text.done,
              fill: text.doneFill.replace('{step}', () => content.next),
            }
          : { label: `⏭ ${text.handToClaude}`, text: content.next, button: text.start, fill: content.next }

    return (
      <Box flexDirection="column">
        <Text>
          <Text bold>{primary.label}: </Text>
          <Text bold>{primary.text}</Text>
        </Text>
        <Text dimColor>🎯 {content.goal}</Text>
        {expanded && content.waiting !== undefined && (
          <Text dimColor>
            ⏭ {text.then}: {content.next}
          </Text>
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
            onPress={() => startNext($, primary.fill, text.fillFailed)}
          />
          <Button
            key="more"
            label={expanded ? text.less : text.details}
            hotkey="2"
            plain
            dimColor
            onPress={() => update($, isExpanded, value => !value)}
          />
          {dismiss}
          {footer !== '' && <Text dimColor>{footer}</Text>}
        </Box>
      </Box>
    )
  })
}
