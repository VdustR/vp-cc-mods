# AGENTS.md

Instructions for agents and people maintaining this repository.

## Purpose

This repository is VdustR's single home for Claude Code mods and Claude Code-only skills. It is also a plugin marketplace named `vp-cc-mods`. Everything here targets Claude Code; content meant for several agents belongs elsewhere.

## Layout

```text
.claude-plugin/marketplace.json   # the marketplace: one entry per plugin
plugins/<name>/                   # one plugin per directory
  .claude-plugin/plugin.json      # manifest: name, version, description, author, types, userConfig
  hooks/hooks.json                # { "modules": ["./register.tsx"] } for a mod
  hooks/register.tsx              # the hooks module
  types/index.d.ts                # the $.state contract, when the mod keeps state
  tests/*.test.tsx                # claude plugin test suites
  skills/vp-cc-<skill>/SKILL.md   # skills the plugin ships, when it has any
  README.md                       # the plugin's own documentation
README.md                         # the collection overview
AGENTS.md                         # this file
```

Claude Code writes `.claude-plugin/types/` and a `tsconfig.json` into a mod it loads from disk. Both are generated and ignored by `.gitignore`; never commit them.

## Naming

- Prefix every plugin name, skill name and slash command with `vp-cc-`, for example `vp-cc-recap` and `/vp-cc-recap`.
- The directory name under `plugins/` equals the plugin's `name` in `plugin.json` and its entry name in `marketplace.json`.
- A mod's `$.state` atoms use the plugin name as their `plugin` key, and `types/index.d.ts` declares them under that same key in `PluginState`.
- Do not start a name with `claude-` or anything else that looks like an Anthropic name; `claude plugin validate` rejects it.

## Add a plugin

1. Create `plugins/vp-cc-<name>/` with the files in the layout above. Start `version` at `0.1.0` and set `author` to `{ "name": "VdustR" }`.
2. Add an entry to `.claude-plugin/marketplace.json` with `name`, `source` (`./plugins/vp-cc-<name>`), `description` and `keywords`.
3. Write `plugins/vp-cc-<name>/README.md` (see Documentation).
4. Add a row to the Plugins table in the root `README.md`.
5. Follow the development flow below.

To prototype, ask Claude in any session for a mod (the built-in `plugin-authoring` skill writes it under `~/.claude/dev-mods/<session-id>/` with hot reload), then move it here and rename it to the `vp-cc-` scheme.

## Write a mod

- Read the type declarations for the running build before writing code: the `plugin-authoring` skill names the file, or read the copy Claude Code writes into `.claude-plugin/types/`. Trust those declarations over any web page when they disagree.
- Follow the static-analysis rules `claude plugin validate` enforces: write each `$` call in full (`$.ui.toast(...)`), pass `$` only to functions declared at the top level of the same file, use string-literal event names, and use only relative imports plus `claude-code`.
- A `ui.render` hook is pure: it reads state and returns a tree. Write `$.state` from handlers (`onPress`) or other events (`turn.complete`, timers).
- Draw for both the `terminal` and `desktop` surfaces. Elements come from `$.ui.resolve(e)`; check the render-sites and elements tables before using a site or an element on Desktop.
- Keep anything that must survive a reload in `$.state` (this session) or `$.store` (across sessions). Module variables reset on every reload.
- Do not send anything to the model or the transcript that the feature does not need. A `command.run` hook that has nothing to print returns `{}`.

## Development flow

The main clone (`~/repo/VdustR/vp-cc-mods`) is the live install: it is added as a local-path marketplace, so its checkout is what every session runs. Keep it on `main` and do all work on a branch in a separate worktree.

### 1. Branch

```bash
git -C ~/repo/VdustR/vp-cc-mods fetch
git -C ~/repo/VdustR/vp-cc-mods worktree add -b <branch> ../vp-cc-mods-worktrees/<branch> origin/main
```

### 2. Automated checks

Run from the worktree root. This is the same script CI runs, so a local pass predicts the CI result.

```bash
node scripts/check.mjs               # every plugin
node scripts/check.mjs vp-cc-<name>  # only the plugins you changed
```

It checks the layout rules (prefix, directory and manifest names, marketplace entries, READMEs) and the English-only rule, runs `claude plugin validate` on the marketplace and each plugin, and runs `claude plugin test` in each plugin with tests. It needs Claude Code 2.1.286 or later, the lowest version it has been run on; set `CLAUDE_BIN` to use a different `claude` executable.

Tests mount drawings on both `terminal` and `desktop`, and stub every `$` call that reaches outside the plugin (`model.fork`, `prompt.fill`, the clock through `mock.clock`).

### 3. Manual check in the terminal

`--plugin-dir` loads the branch's copy and replaces the installed plugin of the same name for that session only:

```bash
claude --plugin-dir plugins/vp-cc-<name>
```

Use the feature as a person would. Saving a file reloads the mod in that session. Add `--debug-file <path>` to see load and hook errors; the log line `Plugin "<name>" from --plugin-dir overrides installed version` confirms the branch copy is the one running.

### 4. Manual check in the Desktop app

The Desktop app cannot take `--plugin-dir`, so point the live clone at the branch for the duration of the check, then put it back:

```bash
git -C ~/repo/VdustR/vp-cc-mods switch --detach <branch>   # the clone must be clean
# in a Desktop session: /reload-plugins, then use the feature
git -C ~/repo/VdustR/vp-cc-mods switch main
# in the Desktop session: /reload-plugins
```

Do this for any change to drawing or interaction, because the Desktop app draws elements differently from the terminal.

### 5. Version and docs

- Bump the plugin's `version` in `plugin.json` for every change that should reach installed copies: patch for fixes, minor for new behavior, major for a breaking change to commands, options or state. An install from GitHub is cached by version, so a change without a bump never reaches it.
- Update the plugin README and the root README in the same change.

### 6. Pull request

Open the pull request with the `vp-autodev` workflow: push the branch, open a Draft PR that fills in the template's Verification list, wait for the `Check` workflow on the current head, handle feedback, mark it Ready, and squash-merge when everything is green. State what was verified manually and what was not.

### 7. After merge

```bash
git -C ~/repo/VdustR/vp-cc-mods pull --ff-only
git -C ~/repo/VdustR/vp-cc-mods worktree remove ../vp-cc-mods-worktrees/<branch>
```

Then run `/reload-plugins` in open sessions, or start a new session, so the live install picks up `main`.

## Documentation

- Write everything in this repository in American English: documentation, code, comments, UI strings, tests, examples, commit messages and pull request text. `scripts/check.mjs` fails on Chinese, Japanese or Korean text in any tracked file.
- A plugin that shows text to the user localizes it at runtime: ask the model to write its output, labels included, in the language the user writes in, and keep English defaults in the code for anything the model omits or gets wrong.
- Each plugin README opens with its value (the problem it solves and why it helps), then usage: what it looks like, how to use it, configuration, how it works, limits, and how to develop it.
- The root README lists every plugin with a one-line value statement and a link to its README.
- Keep a README in step with its plugin's behavior in the same commit.

## Commits

- One coherent change per commit, with an imperative, sentence-case title that states the outcome, for example `Show the waiting decision before the next step`.
- Put verification and non-obvious trade-offs in the body.
- Never commit secrets, tokens, or machine-specific absolute paths.
