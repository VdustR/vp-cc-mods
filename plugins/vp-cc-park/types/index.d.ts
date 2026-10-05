/** One parked idea. */
export type ParkItem = {
  /** Stable id, unique across sessions. */
  id: string
  /** The idea as the person wrote it. */
  text: string
  /** When it was parked, in clock milliseconds. */
  at: number
  /** The project root of the session that parked it. */
  project: string
}

/**
 * Every string the band and the toasts show. A small model translates them
 * into the person's language; English defaults fill any it leaves out.
 * `{n}` and `{text}` are placeholders the mod fills in.
 */
export type ParkLabels = {
  parked: string
  count: string
  show: string
  hide: string
  start: string
  remove: string
  otherProjects: string
  more: string
  empty: string
  fillFailed: string
}

declare module 'claude-code' {
  interface PluginState {
    'vp-cc-park': {
      /** Every parked idea, all projects, oldest first; a copy of the store. */
      items: ParkItem[]
      /** Whether the band lists the ideas or only counts them. */
      isOpen: boolean
      /** The labels in the person's language, or the English defaults. */
      labels: ParkLabels
      /** This session's project root, to tell its ideas from other projects'. */
      project: string
    }
  }
}
