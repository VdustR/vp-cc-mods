// A color scheme: the 20 colors of a terminal theme, in the Windows Terminal scheme format that
// mbadolato/iTerm2-Color-Schemes publishes for every scheme it collects. Everything this plugin draws is worked
// out from these, so any scheme in that format is a theme here, and a person can write their own.

import type { AnsiKey, Scheme } from '../types'
import { isHex } from './color'

export const ANSI_KEYS = [
  'black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightPurple', 'brightCyan', 'brightWhite',
] as const satisfies readonly AnsiKey[]

function color(value: unknown): string | undefined {
  // Some tools write eight digits, with an alpha this plugin does not use.
  const six = typeof value === 'string' ? value.trim().slice(0, 7) : undefined

  return isHex(six) ? six.toLowerCase() : undefined
}

/**
 * Reads a scheme a person wrote or pasted. Takes the Windows Terminal format (`background`, `cursorColor`,
 * `selectionBackground` beside the 16 colors) and the nested form of VdustR/term-ptt-custom-theme (`scheme` and
 * `metadata`, with `cursor` and `selection`). Answers the scheme, or a sentence saying what is wrong.
 */
export function parseScheme(text: string, fallbackName: string): Scheme | string {
  let data: unknown
  try {
    // A reply from a model may wrap the JSON in a code fence or a sentence: read from the first brace to the last.
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    data = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text)
  } catch {
    return 'That is not JSON. Paste a scheme in the Windows Terminal format.'
  }
  if (typeof data !== 'object' || data === null) return 'A scheme is a JSON object of named colors.'
  const top = data as Record<string, unknown>
  const nested = typeof top.scheme === 'object' && top.scheme !== null ? (top.scheme as Record<string, unknown>) : {}
  const meta = typeof top.metadata === 'object' && top.metadata !== null ? (top.metadata as Record<string, unknown>) : {}
  const read = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const found = color(top[key]) ?? color(nested[key]) ?? color(meta[key])
      if (found !== undefined) return found
    }

    return undefined
  }
  const ansi = {} as Record<AnsiKey, string>
  for (const key of ANSI_KEYS) {
    // Some tools write magenta for purple.
    const found = read(key, key.replace('purple', 'magenta').replace('Purple', 'Magenta'))
    if (found === undefined) return `The color "${key}" is missing or is not six-digit hex such as #1d2021.`
    ansi[key] = found
  }
  const background = read('background') ?? ansi.black
  const foreground = read('foreground') ?? ansi.brightWhite
  const name = typeof top.name === 'string' && top.name.trim() !== '' ? top.name.trim().slice(0, 48) : fallbackName
  const accent = read('accent')
  const codeTheme = typeof top.codeTheme === 'string' && /^[a-z0-9-]{1,48}$/.test(top.codeTheme) ? top.codeTheme : undefined

  return {
    name,
    background,
    foreground,
    cursorColor: read('cursorColor', 'cursor') ?? foreground,
    selectionBackground: read('selectionBackground', 'selection') ?? ansi.brightBlack,
    ...ansi,
    ...(accent === undefined ? {} : { accent }),
    ...(codeTheme === undefined ? {} : { codeTheme }),
  }
}
