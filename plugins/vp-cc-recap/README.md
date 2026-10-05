# vp-cc-recap

An ADHD-friendly session recap for Claude Code, drawn above the prompt.

## Why

After a break, the hard part of a long session is starting again: you have to rebuild what you were doing, what is finished, and what comes next before you can act. The built-in session recap gives one line of history. vp-cc-recap gives you the one thing to do next and puts it one keypress away.

- **The next step comes first.** The first line is a single action, in bold. When Claude is waiting on your decision, that question takes the first line instead, because nothing else moves until you answer it.
- **Little to read.** The default view is three lines: the next step, the goal in one sentence, and the buttons. Finished items stay behind **詳細** (Details).
- **Starting takes one press.** The primary button puts the next step in the prompt box for you to review and send. It never sends anything on its own.
- **It tells who acts.** A step for Claude reads **⏭ 交給 Claude** (Hand to Claude) and its button fills in the instruction. A step for you reads **⏭ 你的下一步** (Your next step) and its button, **做完了** (Done), fills in a report back to Claude.
- **A sense of time.** The last line says how long ago the last reply arrived, for when you lose track of time.
- **It stays quiet.** The command leaves nothing in the transcript and nothing in what Claude reads. An automatic recap prepares in the background and appears only when it is ready. A new turn or a new prompt hides a stale one.

## What it looks like

```text
⏭ 交給 Claude：把 recap 搬到 ~/mods
🎯 做 ADHD 友善的 recap
1 開始   2 詳細   3 收起   上次回覆是 12 分鐘前
```

The UI text is in Traditional Chinese, and the recap prompt asks the model for Traditional Chinese.

## Use

| Action | How |
| :- | :- |
| Show a recap now | Run `/vp-cc-recap` |
| Get one automatically | Leave the session idle for `idleMinutes` after a turn ends |
| Act on the first line | Press **1** (開始, 做完了 or 回覆) |
| Show or hide finished items | Press **2** (詳細 / 精簡) |
| Dismiss | Press **3** (收起), or send any prompt |

You can click the buttons. The mods documentation says a digit typed into an empty prompt box presses the matching button above the prompt. That shortcut has not been tested in the Desktop app yet.

What each primary button fills in:

| First line | Button | Text put in the prompt box |
| :- | :- | :- |
| ⏭ 交給 Claude | 開始 | The instruction for Claude |
| ⏭ 你的下一步 | 做完了 | `我做完了：<step>` |
| ⚠ 等你決定 | 回覆 | `關於「<question>」：` |

If the prompt box already holds a draft, the text goes after it, so your draft stays.

## Configure

| Option | Default | Meaning |
| :- | :- | :- |
| `idleMinutes` | `5` | Minutes after a turn ends with no new prompt before a recap is prepared. `0` turns the automatic recap off. Range 0 to 120. |

Set it in `/plugin` (installed copy), or in `settings.json` under `pluginConfigs`, keyed by the plugin id (`vp-cc-recap@vp-cc-mods` when installed from this marketplace).

## How it works

- The recap is one `$.model.fork` call: the session's own last request, with the recap prompt appended. It reuses the conversation's prompt cache, as the built-in recap does, so it adds one short request.
- The model answers in JSON (`next`, `next_by`, `waiting`, `goal`, `done`) and the mod lays it out. A reply that is not valid JSON is shown as Markdown instead.
- The idle timer starts when a main-thread turn completes. A subagent's turn does not start it. A new prompt cancels the timer.

## Limits

- The idle timer counts from the end of a turn. Whether the Desktop window is focused is not tracked.
- A mod loaded in the middle of a session misses the turn that was running when it loaded. The automatic recap starts after the next turn.
- Each recap is one extra model request.

## Develop

From the repository root:

```bash
node scripts/check.mjs vp-cc-recap      # layout, validate and tests
claude --plugin-dir plugins/vp-cc-recap # try the branch copy in the terminal
```

The tests mount the band on the `terminal` and `desktop` surfaces and stub the model, the clock and the prompt box. See the repository [AGENTS.md](../../AGENTS.md) for the full development flow, including the Desktop check.
