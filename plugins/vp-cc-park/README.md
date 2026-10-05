# vp-cc-park

Park a side idea in one command and get back to your task. The ideas wait above the prompt until you pick them up, in the language you write in.

## Why

A side idea that shows up in the middle of a task pulls you away from it: either you follow the idea and lose the task, or you try to hold it in your head and lose both. Writing it down has to cost less than following it, or the idea wins.

- **One command, no detour.** `/vp-cc-park <idea>` stores the idea and shows a short toast. Nothing goes into the transcript or to Claude, so the current task carries on undisturbed. It also works while Claude is still working.
- **Out of your head, not out of sight.** One dim line above the prompt says how many ideas are parked for this project, so they are not forgotten.
- **Picking one up takes one press.** **Start** puts the idea in the prompt box for you to review and send, and unparks it.
- **Kept across sessions.** Ideas stay until you start or remove them, in every session on this machine. Ideas from other projects are listed apart, so a list never mixes up two projects.
- **Your language.** A small model translates the labels into the language you write in, once per session. English is the fallback.

## What it looks like

Collapsed, after two ideas were parked:

```text
 park  🅿 2 parked   Show
```

After **Show**, or `/vp-cc-park` with no idea:

```text
 park  🅿 2 parked   Hide
       • Rename the branch before the PR   Start   Remove
       • Write the timebox README   Start   Remove
       Other projects
       • Fix the flaky test (site)   Start   Remove
```

The ` park ` tag is drawn in inverse video, so the block stands apart from other plugins' blocks in the same band.

This is the English version. In a session where you write another language, the labels appear in that language once you have sent a prompt and used the command.

## Use

| Action | How |
| :- | :- |
| Park an idea | Run `/vp-cc-park <idea>` |
| Show or hide the list | Run `/vp-cc-park` with no idea, or press **Show** / **Hide** (hotkey **p**) |
| Pick an idea up | Press **Start**: the idea goes in the prompt box and leaves the list |
| Drop an idea | Press **Remove** |

If the prompt box already holds a draft, **Start** puts the idea after it, so your draft stays.

## Configure

| Option | Default | Meaning |
| :- | :- | :- |
| `showCount` | `true` | Show the dim count line above the prompt while this project has parked ideas. `false` keeps the band empty until you ask for the list. |

Set it in `/plugin` (installed copy), or in `settings.json` under `pluginConfigs`, keyed by the plugin id (`vp-cc-park@vp-cc-mods` when installed from this marketplace).

## How it works

- Ideas are kept in the plugin's `$.store`, which every session on this machine shares. Each idea has its own key, so two sessions that park at the same time do not overwrite each other. The store keeps the newest 100 ideas.
- Each idea records the project root of the session that parked it. The list shows this project's ideas first, newest first, then other projects' ideas with the project's folder name.
- A session reads the store again when it starts, after each of its turns, and when you open the list, so ideas parked in another session appear there too.
- The labels: the first time you use the command in a session, one `$.model.complete` call on a small model (`haiku`) translates them, using your last few prompts as the sample of your language. The result is kept for the next session to start with. A label that is missing or drops its placeholder (`{n}`, `{text}`) keeps its English default.

## Limits

- The list shows six ideas at a time; the rest are counted.
- Labels stay in the previous session's language until you use the command in the new session.
- An idea is plain text. It does not record which session or message it came from.

## Develop

From the repository root:

```bash
node scripts/check.mjs vp-cc-park       # layout, shared copies, English-only, validate and tests
claude --plugin-dir plugins/vp-cc-park  # try the branch copy in the terminal
```

The tests mount the band on the `terminal` and `desktop` surfaces and stub the store, the clock, the prompt box and the model. See the repository [AGENTS.md](../../AGENTS.md) for the full development flow, including the Desktop check.
