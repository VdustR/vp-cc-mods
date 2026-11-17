// Copies a plugin into a session's hot-reload folder under a dev name, so a Desktop session can run the working
// tree's copy beside the installed one.
//
//   node scripts/dev-copy.mjs vp-cc-<name> <session-id>
//
// The copy is named `dev-<plugin name>`: its manifest, its `PluginState` key, its atoms and its slash command all
// take the prefix, so it has its own command (`/dev-vp-cc-<name>`), its own pane and its own store, apart from
// the installed plugin's. Run it again after each edit; the session reloads the copy when its current turn ends.
// AGENTS.md, "Manual check in the Desktop app", says how to work with the copy.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [name, session] = process.argv.slice(2)
if (name === undefined || session === undefined) {
  console.error('Usage: node scripts/dev-copy.mjs vp-cc-<name> <session-id>')
  process.exit(1)
}
const source = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', name)
if (!existsSync(join(source, '.claude-plugin', 'plugin.json'))) {
  console.error(`No plugin at plugins/${name}`)
  process.exit(1)
}
const devName = `dev-${name}`
const target = join(homedir(), '.claude', 'dev-mods', session, devName)

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
// Only what a mod loads. Tests are left out: they name the plugin and would run against the copy's new name.
for (const part of ['.claude-plugin', 'hooks', 'types', 'skills']) {
  if (existsSync(join(source, part))) cpSync(join(source, part), join(target, part), { recursive: true })
}
// Claude Code writes its own type declarations into a mod it loads; a stale copy of them would shadow those.
rmSync(join(target, '.claude-plugin', 'types'), { recursive: true, force: true })

/** Every file under a folder. */
function files(folder) {
  return readdirSync(folder).flatMap(entry => {
    const path = join(folder, entry)

    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

// The plugin's name wherever it is written, but not where it already carries the prefix.
const pattern = new RegExp(`(?<!dev-)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
let changed = 0
for (const path of files(target)) {
  const before = readFileSync(path, 'utf8')
  const after = before.replace(pattern, devName)
  if (after !== before) {
    writeFileSync(path, after)
    changed += 1
  }
}
console.log(`Copied ${name} to ${target} as ${devName} (${changed} files renamed inside)`)
