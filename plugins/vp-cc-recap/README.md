# vp-cc-recap

An ADHD-friendly session recap for Claude Code, drawn above the prompt, in the language you write in.

## Why

After a break, the hard part of a long session is starting again: you have to rebuild what you were doing, what is finished, and what comes next before you can act. The built-in session recap gives one line of history. vp-cc-recap gives you the one thing to do next and puts it one keypress away.

- **The next step comes first.** The first line is a single action, in bold. When Claude is waiting on your decision, that question takes the first line instead, because nothing else moves until you answer it.
- **Little to read.** The default view is three lines: the next step, the goal in one sentence, and the buttons. Finished items stay behind **Details**.
- **Starting takes one press.** The primary button puts the next step in the prompt box for you to review and send. It never sends anything on its own.
- **It tells who acts.** A step for Claude reads **⏭ Hand to Claude** and its **Start** button fills in the instruction. A step for you reads **⏭ Your next step** and its **Done** button fills in a report back to Claude.
- **A sense of time.** The last line says how long ago the last reply arrived, for when you lose track of time.
- **Your language.** The model writes the recap and every label in the language you have mostly used in the session, so the band switches language with you. English is the fallback.
- **It stays quiet.** The command leaves nothing in the transcript and nothing in what Claude reads. An automatic recap prepares in the background and appears only when it is ready. A new turn or a new prompt hides a stale one.

## What it looks like

```text
⏭ Hand to Claude: Move the plugin into the repo
🎯 Ship an ADHD-friendly recap
1 Start   2 Details   3 Dismiss   Last reply 12 min ago
```

This is the English version. In a session where you write another language, the same layout appears with the model's translation of every label.

## Use

| Action | How |
| :- | :- |
| Show a recap now | Run `/vp-cc-recap` |
| Get one automatically | Leave the session idle for `idleMinutes` after a turn ends |
| Act on the first line | Press **1** (Start, Done or Reply) |
| Show or hide finished items | Press **2** (Details / Less) |
| Dismiss | Press **3** (Dismiss), or send any prompt |

You can click the buttons. The mods documentation says a digit typed into an empty prompt box presses the matching button above the prompt. That shortcut has not been tested in the Desktop app yet.

What each primary button fills in:

| First line | Button | Text put in the prompt box |
| :- | :- | :- |
| ⏭ Hand to Claude | Start | The instruction for Claude |
| ⏭ Your next step | Done | `I finished: <step>` |
| ⚠ Waiting on you | Reply | `About "<question>": ` |

If the prompt box already holds a draft, the text goes after it, so your draft stays.

## Configure

| Option | Default | Meaning |
| :- | :- | :- |
| `idleMinutes` | `5` | Minutes after a turn ends with no new prompt before a recap is prepared. `0` turns the automatic recap off. Range 0 to 120. |

Set it in `/plugin` (installed copy), or in `settings.json` under `pluginConfigs`, keyed by the plugin id (`vp-cc-recap@vp-cc-mods` when installed from this marketplace).

## How it works

- The recap is one `$.model.fork` call: the session's own last request, with the recap prompt appended. It reuses the conversation's prompt cache, as the built-in recap does, so it adds one short request.
- The model answers in JSON: `next`, `next_by`, `waiting`, `goal`, `done`, and `ui`, the band's labels translated into the user's language. The mod lays them out.
- A label that is missing, empty, or drops its placeholder (`{n}`, `{step}`, `{question}`) keeps its English default. A reply that is not valid JSON is shown as Markdown instead.
- The latest labels are kept for the session, so states drawn before a reply arrives (preparing, nothing to recap yet, failed) use the same language as the last recap. Before the first recap they are in English.
- The idle timer starts when a main-thread turn completes. A subagent's turn does not start it. A new prompt cancels the timer.

## Limits

- The language follows the model's reading of the session. A session that mixes languages gets the one the model judges you use most.
- The idle timer counts from the end of a turn. Whether the Desktop window is focused is not tracked.
- A mod loaded in the middle of a session misses the turn that was running when it loaded. The automatic recap starts after the next turn.
- Each recap is one extra model request.

## Develop

From the repository root:

```bash
node scripts/check.mjs vp-cc-recap      # layout, English-only, validate and tests
claude --plugin-dir plugins/vp-cc-recap # try the branch copy in the terminal
```

The tests mount the band on the `terminal` and `desktop` surfaces and stub the model, the clock and the prompt box. See the repository [AGENTS.md](../../AGENTS.md) for the full development flow, including the Desktop check.
