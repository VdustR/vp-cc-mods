/** What started a recap. */
export type RecapTrigger = 'manual' | 'idle'

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
  | { phase: 'error'; trigger: RecapTrigger; reason: string }

declare module 'claude-code' {
  interface PluginState {
    'vp-cc-recap': {
      view: RecapView
      /** Whether the band shows the finished items too. */
      isExpanded: boolean
    }
  }
}
