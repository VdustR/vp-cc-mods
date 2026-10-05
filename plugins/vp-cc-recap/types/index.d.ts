/** What started a recap. */
export type RecapTrigger = 'manual' | 'idle'

/**
 * Every string the band draws. The model returns them in the user's language
 * with each recap; English defaults fill any it leaves out or gets wrong.
 * `{n}`, `{step}` and `{question}` are placeholders the mod fills in.
 */
export type RecapLabels = {
  handToClaude: string
  yourStep: string
  waiting: string
  then: string
  start: string
  done: string
  reply: string
  details: string
  less: string
  dismiss: string
  lastReplyJustNow: string
  lastReplyMinutesAgo: string
  doneFill: string
  replyFill: string
  preparing: string
  nothingYet: string
  failed: string
  fillFailed: string
}

/** The recap the model returns, parsed from its JSON reply. */
export type RecapContent = {
  /** The one action the person can take now. */
  next: string
  /** Who carries out `next`: Claude, from a prompt, or the person themselves. */
  nextBy: 'claude' | 'user'
  /** A decision waiting on the person, when there is one; it outranks `next`. */
  waiting?: string
  /** What the session is working toward, one sentence. */
  goal: string
  /** At most three finished items. */
  done: string[]
}

/** What the band above the prompt shows. */
export type RecapView =
  | { phase: 'hidden' }
  | { phase: 'generating'; trigger: RecapTrigger }
  | {
      phase: 'shown'
      trigger: RecapTrigger
      /** Parsed recap; absent when the reply was not the expected JSON. */
      content?: RecapContent
      /** The reply as written, drawn when `content` is absent. */
      raw: string
      /** When the last main-thread turn ended, in clock milliseconds. */
      lastTurnAt?: number
    }
  | { phase: 'error'; trigger: RecapTrigger; reason: 'nothing-yet' | 'failed'; detail?: string }

declare module 'claude-code' {
  interface PluginState {
    'vp-cc-recap': {
      view: RecapView
      /** Whether the band shows the finished items too. */
      isExpanded: boolean
      /** The labels from the latest recap, so states drawn before a reply match its language. */
      labels: RecapLabels
    }
  }
}
