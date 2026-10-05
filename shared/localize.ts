// Interface labels in the person's language, for plugins that draw text
// without asking the model anything else. Pure helpers: the plugin makes the
// one model call itself, because a hooks module passes `$` only to functions
// declared in its own file.
//
// This file is the canonical copy. A plugin uses it as `hooks/localize.ts`,
// copied byte for byte, because an installed plugin is copied alone and cannot
// import from outside its own folder. `node scripts/check.mjs` fails on a copy
// that differs from this file.

/** Labels keyed by name; every value is a string, `{name}` marks a placeholder. */
export type Labels = { readonly [key: string]: string }

const SAMPLE_COUNT = 3
const SAMPLE_LENGTH = 300
const LABEL_LENGTH = 80

/**
 * Adds a prompt the person typed to the language sample and returns the new
 * sample: the latest few prompts, each cut short. Slash commands and empty
 * prompts are left out, because they say little about the language.
 */
export function addSample(samples: readonly string[], text: string): string[] {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed.startsWith('/')) return [...samples]
  return [...samples, trimmed.slice(0, SAMPLE_LENGTH)].slice(-SAMPLE_COUNT)
}

/** The one message that asks a small model to translate `defaults`. */
export function labelsPrompt(defaults: Labels, samples: readonly string[]): string {
  return `Translate the interface labels of a small tool into the language of the person's messages below.

Reply with one JSON object that has exactly the keys of the labels, and nothing else, no code fence. Keep every {placeholder} exactly as written. Keep each label as short as the English. Keep emoji and punctuation. When the messages are in English or their language is unclear, return the labels unchanged.

Messages:
${samples.map(sample => `- ${JSON.stringify(sample)}`).join('\n')}

Labels:
${JSON.stringify(defaults)}`
}

const placeholders = (text: string) => text.match(/\{\w+\}/g) ?? []

/**
 * Reads the model's reply into a full set of labels. A label that is missing,
 * empty, too long, or drops a placeholder of its default keeps the default.
 */
export function parseLabels<T extends Labels>(reply: unknown, defaults: T): T {
  let given: unknown = reply
  if (typeof reply === 'string') {
    const start = reply.indexOf('{')
    const end = reply.lastIndexOf('}')
    if (start === -1 || end <= start) return defaults
    try {
      given = JSON.parse(reply.slice(start, end + 1))
    } catch {
      return defaults
    }
  }
  if (typeof given !== 'object' || given === null) return defaults
  const fields = given as Record<string, unknown>
  const result: Record<string, string> = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const text = fields[key]
    if (typeof text !== 'string' || text.trim() === '' || text.length > LABEL_LENGTH) continue
    if (placeholders(defaults[key] ?? '').every(placeholder => text.includes(placeholder))) {
      result[key] = text
    }
  }
  return result as T
}

/** Fills each `{name}` in `template` from `values`, leaving unknown ones as written. */
export function fill(template: string, values: { readonly [name: string]: string | number }): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}
