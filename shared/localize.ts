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

Reply with one JSON object that has the keys of the labels plus one key "_lang", and nothing else, no code fence. "_lang" is the BCP 47 tag of the language you wrote the labels in, for example "en", "de" or "zh-TW". Keep every {placeholder} exactly as written. Keep each label as short as the English. Keep emoji and punctuation. When the messages are in English or their language is unclear, return the labels unchanged.

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

const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

/** The BCP 47 tag the model gave for its labels (`_lang`), or undefined. */
export function parseLanguage(reply: unknown): string | undefined {
  let given: unknown = reply
  if (typeof reply === 'string') {
    const start = reply.indexOf('{')
    const end = reply.lastIndexOf('}')
    if (start === -1 || end <= start) return undefined
    try {
      given = JSON.parse(reply.slice(start, end + 1))
    } catch {
      return undefined
    }
  }
  if (typeof given !== 'object' || given === null) return undefined
  const tag = (given as Record<string, unknown>)._lang
  return typeof tag === 'string' && LANGUAGE_TAG.test(tag) ? tag : undefined
}

const HANGUL = /[\uac00-\ud7af\u1100-\u11ff]/
const KANA = /[\u3040-\u30ff]/
const HAN = /[\u3400-\u9fff\uf900-\ufaff]/

/**
 * The language a speech voice should read `text` in. A line can mix the
 * labels' language with what the person typed (an English "Time's up:" and a
 * task in Chinese), and a voice of one script reads another as noise, so
 * Hangul, kana and Han characters in the text win over the labels' `lang`.
 */
export function speechLanguage(text: string, lang: string | undefined): string | undefined {
  if (HANGUL.test(text)) return 'ko'
  if (KANA.test(text)) return 'ja'
  if (HAN.test(text)) return lang !== undefined && /^(zh|ja)(-|$)/i.test(lang) ? lang : 'zh'
  return lang
}

// Script subtags that name a region's usual locale for a speech voice.
const SCRIPT_LOCALES: { readonly [tag: string]: string } = {
  'zh-hant': 'zh_tw',
  'zh-hans': 'zh_cn',
}

/**
 * Picks a speech voice for `lang` from the listing `say -v ?` prints on macOS
 * (`Name (Description) xx_YY  # sample` per line): a voice of the exact locale
 * first, then any voice of the same language, each preferring the language's
 * own voice over the shared novelty voices. Undefined for English, for an
 * unknown language, or when no voice matches, so the system default speaks.
 */
export function pickVoice(listing: string, lang: string | undefined): string | undefined {
  if (lang === undefined) return undefined
  const tag = lang.toLowerCase()
  if (tag === 'en' || tag.startsWith('en-')) return undefined
  const locale = SCRIPT_LOCALES[tag] ?? tag.replace(/-/g, '_')
  const language = locale.split('_')[0]
  const voices: { name: string; locale: string }[] = []
  for (const line of listing.split('\n')) {
    const match = /^(.*\S)\s+([a-z]{2,3}_[A-Za-z0-9]+)\s+#/.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      voices.push({ name: match[1], locale: match[2].toLowerCase() })
    }
  }
  // A name with a parenthesized language ("Eddy (Chinese (Taiwan))") is one of
  // the shared novelty voices; a plain name ("Meijia") is the language's own.
  const isPlain = (voice: { name: string }) => !voice.name.includes(' (')
  const exact = voices.filter(voice => voice.locale === locale)
  const same = voices.filter(voice => voice.locale.split('_')[0] === language)
  return (exact.find(isPlain) ?? exact[0] ?? same.find(isPlain) ?? same[0])?.name
}

/** Fills each `{name}` in `template` from `values`, leaving unknown ones as written. */
export function fill(template: string, values: { readonly [name: string]: string | number }): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}
