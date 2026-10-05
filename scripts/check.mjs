#!/usr/bin/env node
// Runs every automated check this repository requires before a pull request:
// marketplace and plugin layout rules, the English-only rule for tracked files, `claude plugin validate` on the
// marketplace and each plugin, and `claude plugin test` in each plugin that
// has tests. CI runs the same script.
//
// Usage: node scripts/check.mjs [plugin-name ...]
//   With no names, every plugin under plugins/ is checked.
//   CLAUDE_BIN selects the claude executable (default: `claude` on PATH).

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// The lowest Claude Code version these checks have been run on.
const MIN_VERSION = [2, 1, 286]
const PREFIX = 'vp-cc-'

const root = resolve(import.meta.dirname, '..')
const claude = process.env.CLAUDE_BIN || 'claude'
const failures = []

const fail = message => {
  failures.push(message)
  console.error(`✘ ${message}`)
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))

function run(label, args, cwd) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(claude, args, { cwd, stdio: 'inherit' })
  if (result.error) {
    fail(`${label}: could not run ${claude} (${result.error.message})`)
  } else if (result.status !== 0) {
    fail(`${label}: exited with ${result.status}`)
  }
}

function checkClaudeVersion() {
  const result = spawnSync(claude, ['--version'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    fail(`cannot run ${claude}; install Claude Code or set CLAUDE_BIN`)
    return false
  }
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(result.stdout)
  const version = match ? match.slice(1).map(Number) : [0, 0, 0]
  const isOld = version.some((part, index) =>
    version.slice(0, index).every((earlier, i) => earlier === MIN_VERSION[i]) &&
    part < MIN_VERSION[index],
  )
  console.log(`claude ${version.join('.')} (${claude})`)
  if (isOld) {
    fail(`claude ${version.join('.')} is older than ${MIN_VERSION.join('.')}; run \`claude update\` or set CLAUDE_BIN`)
    return false
  }
  return true
}

function checkLayout() {
  const marketplace = readJson(join(root, '.claude-plugin/marketplace.json'))
  const entries = new Map(marketplace.plugins.map(entry => [entry.name, entry]))
  const dirs = readdirSync(join(root, 'plugins'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  for (const dir of dirs) {
    const manifestPath = join(root, 'plugins', dir, '.claude-plugin/plugin.json')
    if (!existsSync(manifestPath)) {
      fail(`plugins/${dir}: missing .claude-plugin/plugin.json`)
      continue
    }
    const manifest = readJson(manifestPath)
    if (manifest.name !== dir) fail(`plugins/${dir}: plugin.json name is "${manifest.name}"`)
    if (!dir.startsWith(PREFIX)) fail(`plugins/${dir}: name must start with ${PREFIX}`)
    if (!manifest.version) fail(`plugins/${dir}: plugin.json has no version`)
    if (!existsSync(join(root, 'plugins', dir, 'README.md'))) fail(`plugins/${dir}: missing README.md`)
    const entry = entries.get(dir)
    if (!entry) fail(`plugins/${dir}: no entry in .claude-plugin/marketplace.json`)
    else if (entry.source !== `./plugins/${dir}`) fail(`marketplace entry ${dir}: source is "${entry.source}"`)
    const skillsDir = join(root, 'plugins', dir, 'skills')
    if (existsSync(skillsDir)) {
      for (const skill of readdirSync(skillsDir)) {
        if (!skill.startsWith(PREFIX)) fail(`plugins/${dir}/skills/${skill}: name must start with ${PREFIX}`)
      }
    }
  }
  for (const name of entries.keys()) {
    if (!dirs.includes(name)) fail(`marketplace entry ${name}: no plugins/${name} directory`)
  }
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  for (const dir of dirs) {
    if (!readme.includes(`plugins/${dir}/README.md`)) fail(`README.md: no link to plugins/${dir}/README.md`)
  }
  return dirs
}

// The repository is written in English; text in other scripts belongs in the
// model's output at runtime, never in the source.
const NON_ENGLISH = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/

function checkEnglishOnly() {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    fail('english: git ls-files failed')
    return
  }
  for (const file of result.stdout.split('\0').filter(Boolean)) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const lines = readFileSync(path, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (NON_ENGLISH.test(line)) fail(`${file}:${index + 1}: non-English text`)
    })
  }
}

const hasTests = dir =>
  readdirSync(dir, { recursive: true }).some(
    file => typeof file === 'string' && /\.test\.tsx?$/.test(file) && !file.includes('node_modules'),
  )

console.log('▶ layout')
const allPlugins = checkLayout()
console.log('▶ english')
checkEnglishOnly()
const selected = process.argv.slice(2)
for (const name of selected) {
  if (!allPlugins.includes(name)) fail(`unknown plugin ${name}`)
}
const plugins = selected.length > 0 ? selected.filter(name => allPlugins.includes(name)) : allPlugins

if (checkClaudeVersion()) {
  run('validate marketplace', ['plugin', 'validate', '.'], root)
  for (const name of plugins) {
    const dir = join(root, 'plugins', name)
    run(`validate ${name}`, ['plugin', 'validate', dir], root)
    if (hasTests(dir)) run(`test ${name}`, ['plugin', 'test'], dir)
    else console.log(`\n• ${name}: no tests`)
  }
}

if (failures.length > 0) {
  console.error(`\n✘ ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\n✔ all checks passed')
