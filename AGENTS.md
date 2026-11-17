# AGENTS.md

Instructions for agents and people maintaining this repository.

## Purpose

This repository is VdustR's single home for Claude Code mods and Claude Code-only skills. It is also a plugin marketplace named `vp-cc-mods`. Everything here targets Claude Code; content meant for several agents belongs elsewhere.

## Layout

```text
.claude-plugin/marketplace.json   # the marketplace: one entry per plugin
plugins/<name>/                   # one plugin per directory
  .claude-plugin/plugin.json      # manifest: name, version, description, author, types, userConfig
  hooks/hooks.json                # { "hooks": {}, "modules": ["./register.tsx"] } for a mod
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

- Write `hooks/hooks.json` as `{ "hooks": {}, "modules": ["./register.tsx"] }`. The mod engine reads `modules`; the classic plugin loader (`/reload-plugins` and `claude plugin validate`) still expects a `hooks` record and errors ("hooks: Invalid input: expected record, received undefined") when the key is absent. The empty record satisfies the classic loader without adding any classic hook, so both loaders accept the file.
- Read the type declarations for the running build before writing code: the `plugin-authoring` skill names the file, or read the copy Claude Code writes into `.claude-plugin/types/`. Trust those declarations over any web page when they disagree.
- Follow the static-analysis rules `claude plugin validate` enforces: write each `$` call in full (`$.ui.toast(...)`), pass `$` only to functions declared at the top level of the same file, use string-literal event names, and use only relative imports plus `claude-code`.
- A `ui.render` hook is pure: it reads state and returns a tree. Write `$.state` from handlers (`onPress`) or other events (`turn.complete`, timers).
- Draw for both the `terminal` and `desktop` surfaces. Elements come from `$.ui.resolve(e)`; check the render-sites and elements tables before using a site or an element on Desktop.
- Keep anything that must survive a reload in `$.state` (this session) or `$.store` (across sessions). Module variables reset on every reload.
- Do not send anything to the model or the transcript that the feature does not need. A `command.run` hook that has nothing to print returns `{}`.
- The band above the prompt (`AbovePrompt`) is one site that every mod shares, and a tree returned without the rest of the chain hides every mod drawn after it. Always stack: `const below = await next(e)`, then return `<Box flexDirection="column">{mine}{below}</Box>`, or `below` alone when there is nothing to show.
- Draw a plugin's band block behind its name tag, so the person can tell it apart from other mods' blocks: put `<Text inverse bold>{' <short name> '}</Text>` (the plugin name without `vp-cc-`) and the block side by side in a `<Box gap={1} alignItems="flex-start">`. The tag is never translated and never drawn alone.
- Give every Button of a new plugin a key prefixed with the plugin's short name (`<short name>:<action>`), and take hotkeys only from the table below, so two plugins drawing at once never claim the same key. `vp-cc-recap` predates this rule and keeps its unprefixed keys.
- Every session on the machine shares a plugin's `$.store`, and a read followed by a write is not atomic. Keep each record under its own key (`item:<id>`) and read again right before a write.
- Inside `declare module 'claude-code'` in `types/index.d.ts`, a type name resolves to Claude Code's own type of that name first. A contract that names its value `Settings` gets Claude Code's `Settings` (`Record<string, unknown>`), and every read of the atom is then untyped. Give the plugin's types names Claude Code does not use, such as `LookSettings`. The contract must also be self-contained: `claude plugin validate` refuses an `import` in it, so the hooks import shared types from `../types`, not the other way.
- A mod that sets a theme or draws a backdrop follows [Themes and backdrops](#themes-and-backdrops) below.
- Give every Button in one drawing its own label, not only its own key. The label is the control's accessible name: two buttons both labelled `Remove`, or a `Standard` in two rows, cannot be told apart by a screen reader or by an automation tool, which then presses the first one. An `Input` with no `label` is named by its `key`.
- `$.model.complete({ model, system, prompt, maxTokens })` answers a question that needs nothing from the conversation, and sends none of it. `$.model.fork` is for a question about the session. A reply may wrap JSON in a code fence or a sentence, so read from the first brace to the last.
- `$.ui.status` raised no error in the Desktop app, but nothing appeared under the prompt there (checked on engine 2.1.286). Draw in the band instead.

### Themes and backdrops

Everything here was checked on engine 2.1.325 in the Desktop app, with `vp-cc-theme-hammerhead`.

What the API has:

- `$.theme.set` takes three things: `colors`, `backdrop` and `overrideColorScheme`. There is no radius, font, shadow or spacing. `colors` holds about 100 color tokens a mode, plus `codeTheme` and `contrast: 'more'`.
- The Desktop app ignores `overrideColorScheme`: a mod cannot pin light or dark, and cannot read which one the app is in. Give both modes and let the app pick.
- `backdrop` is a scene (an SVG a `ui.render` hook on `Backdrop` answers, with `glass`) or a still ground (`{ color }`, `{ gradient }`, `{ image }`, `{ vector }`, no hook and no glass). `{ color: 'surface-0' }` is the page's own color and follows the mode.
- `glass` is `{ blur, tint, opacity }` or `false`. It frosts the whole conversation area over the scene, not only the side panels: at blur 14 and opacity 0.62 the scene is gone, at blur 4 and opacity 0.4 it is soft, and `false` shows it at full strength.
- `codeTheme: { light, dark }` works, and takes the place of the code theme chosen in the app's Appearance settings while the theme is set. The names are the Shiki theme ids: `catppuccin-latte` and `gruvbox-light-medium` were seen to apply. The app keeps its own for a name it does not offer, with no error. Without `codeTheme`, code is colored from the roles.
- A session has one theme, and the latest `$.theme.set` wins.

What fails without an error:

- **A backdrop is drawn again only for a scene name the app has not drawn.** A later `$.theme.set` with the same `scene` recolors the app and leaves the old SVG behind it. Name each drawing's scene differently, for example `sea-1`, `sea-2`, and match the name by its prefix in the render hook.
- **The Desktop app ignores a whole theme when one piece of text is under its contrast floor.** `makeColors` lists that as a problem line starting `Desktop won't paint`. Check for it at run time when the colors come from a person, and ease the palette until the line is gone.
- A `/clear` raises `session.end` with `reason: 'clear'` and no `session.start`, and the theme goes with it. Set it again on the next `prompt.submit`.

Building colors:

- Copy `make-colors.js` and `make-colors.d.ts` from the `plugin-authoring` skill's folder into `hooks/` unchanged, import `./make-colors.js`, and call `makeColors` at run time. Copy them again when Claude Code updates. `claude plugin validate` and the English-only check accept the file.
- In dark mode keep `surface-3` close to `surface-0`: a light menu surface is the usual cause of a theme the app will not paint. In both modes `surface-0` is the darkest surface.
- A role's seed keeps its hue and the design system sets its lightness, so making a seed lighter or darker does not fix a role that fails. Leaving that one role out, which keeps the app's own, does.
- From a terminal scheme (background, foreground, 16 colors): of 912 schemes in mbadolato/iTerm2-Color-Schemes, a plain mapping (background as `surface-0`, foreground as text, the rest filled in) painted 589, small fixed surface steps painted 743, and flattening those steps painted 789. Leaving out the failing role, the next step, was run on the shipped schemes only, not on the whole collection. In a light scheme the "bright" colors are often the darker ones, and in Solarized the bright slots hold grays, so pick the bright twin only when it is the same hue and contrasts more.
- A scene is told nothing about light or dark. Carry both palettes in the SVG and switch with `@media (prefers-color-scheme: light)`, which the Desktop app honors, as it does `prefers-reduced-motion`.

### Hotkeys in the band

| Plugin | Hotkeys |
| :- | :- |
| `vp-cc-recap` | `1`, `2`, `3` |

Add a row when a plugin takes a hotkey.

### Testing notes

- In a test, `$.prompt.submit` from the test raises `prompt.submit` with no `origin`. A hook that reads `e.origin` must allow for that.
- A test that stubs a method event answers it with `{ value }`, including `ui.toast` (`{ value: undefined }`).
- The test's `$` has no `$.store`, and a plugin's own `$.store` has nothing beneath it: stub `store.get` and `store.set` (each answers `{ value }`), or every read in the plugin rejects. Keep the stub's map to check what the plugin stored.
- A hook that swallows its errors hides a missing stub: the test sees nothing happen. When a plugin does nothing in a test, look for a `$` call with no hook beneath it first (`store.get`, `command.register`, `ui.open`, `model.complete`).
- Register every stub before the test first calls `$`: an `on(...)` after that throws. To run one body on several surfaces, loop outside and make one `test` a surface, not one test that sets up twice.
- Work a hook starts without awaiting (`void apply($)`) may not have finished when the raising call resolves. Give it a moment before asserting. The module environment has `setTimeout` but declares no type for it.
- The kit's types refuse some valid stubs and targets: a `{ value }` answer for `command.register` or `model.complete`, and a `Pane` mounted with `props: {}`. Cast those to `never`; the tests run either way.
- Tests do not paint. They show that a look is set and what it holds, not what it looks like.
- `session.start` does not run under `claude plugin test` unless the test raises it. Read what a plugin needs from the session (its root, for example) lazily, not only in `session.start`, or the tests never exercise it.

## Official resources

Read these before writing a new kind of mod. The type declarations for the running build remain the authority when they disagree with a page.

- [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview): what mods can do and where they run.
- [Create a mod](https://code.claude.com/docs/en/plugins/mods/create): the authoring loop, validation and type declarations.
- [Interface](https://code.claude.com/docs/en/plugins/mods/interface): panes, the band, elements, focus, hotkeys, `$.state` and `$.store`.
- [Events](https://code.claude.com/docs/en/plugins/mods/events): the middleware chain, matchers, the order mods run in, error handlers.
- [API](https://code.claude.com/docs/en/plugins/mods/api): commands, tools, model calls, timers, background work.
- [Reference](https://code.claude.com/docs/en/plugins/mods/reference): every event, method, render site and element per app, and the limits.
- [Test](https://code.claude.com/docs/en/plugins/mods/test): the `claude-code/testing` kit.
- [Troubleshoot](https://code.claude.com/docs/en/plugins/mods/troubleshoot): load failures, skipped hooks, drawings that do not appear.
- [Plugin evals](https://code.claude.com/docs/en/plugin-evals): `claude plugin eval`, behavior tests that run real model sessions. They can consume many tokens, so run them only when the repository owner asks; `claude plugin test` is the default check.
- The built-in `plugin-authoring` skill: run `/plugin-authoring` or ask Claude for a mod; it names the type declarations for the running build.
- Example mods with tests: the [built-in mods](https://github.com/anthropics/claude-code/tree/main/mods) (`diff`, `agents-md`, `sec-default`, `telemetry`) and the [playground mods](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods) (`token-weather`, `blast-radius`, `replay-theater`).

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

Driving the Desktop app from a session, to check a mod without the person's hands:

- **Hot reload.** A mod in `~/.claude/dev-mods/<session-id>/<name>/` reloads when the turn that changed it ends, not while it runs. Copy the plugin there under another name (replace the plugin name everywhere, the `PluginState` key included), start a short background command, end the turn, and continue when its notification arrives. `$.store` and `$.state` survive the reload; module variables do not. The dev copy has its own store, apart from the installed plugin's.
- **A pane without typing a command.** Have the dev copy open its pane at `session.start`. Typing a slash command into the prompt box from a tool sends a message into the session.
- **`agent-desktop`.** Several processes are named Claude, so `--app Claude` is ambiguous: take the main window's id from `agent-desktop list-windows` and pass `--window-id`. The app's buttons refuse a headless click; `--headed` clicks them and takes the pointer, so do it only with the person's leave. Find a control by its accessible name in `snapshot -i --compact`, which is why labels must be unique. Take a fresh snapshot before `type`: a ref from before a click goes stale.
- **Light and dark.** There is no API for the app's mode. Open Settings (the `Code settings` button), then `Appearance`, then the `Light`, `Dark` or `System` radio button, then `Close`. Note which was selected first and put it back.
- **What accessibility does not show.** The options of the app's dropdowns, such as the code theme list, and colors. Read those from a screenshot. For a color question, crop the same region from two screenshots at full size and compare: a scaled screenshot hides a change of hue.
- **Pasting.** To put a long text in a field, copy it with `pbcopy`, select all, paste, and restore the clipboard afterwards.
- **The person may be using the app too.** A setting that changed between two of your steps may be their doing. Leave their choices as you found them.

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
