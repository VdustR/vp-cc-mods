# vp-cc-mods

Claude Code [mods](https://code.claude.com/docs/en/plugins/mods/overview) by VdustR, published as a plugin marketplace named `vp-cc-mods`.

Mods require Claude Code v2.1.287 or later. The Desktop app's bundled engine 2.1.286 also loads them.

## Plugins

| Plugin | What it does |
| :- | :- |
| [`vp-cc-brief`](plugins/vp-cc-brief) | An ADHD-friendly session recap above the prompt. It leads with the one next step, shows the goal in one line, and keeps finished items behind a toggle. `/vp-cc-brief` shows it on demand. After a turn ends, it is prepared automatically once you have been idle for `idleMinutes` (default 5, `0` turns it off). |

## Install

Add the marketplace, then install a plugin:

```text
/plugin marketplace add VdustR/vp-cc-mods
/plugin install vp-cc-brief@vp-cc-mods
```

An install from GitHub is cached by version, so a change reaches you after the plugin's `version` increases and you update it.

## Develop

Add the marketplace from a local clone instead. Its plugins then load in place from the clone, and an edit takes effect at the next session start or after `/reload-plugins`, with no version bump:

```text
/plugin marketplace add ~/repo/VdustR/vp-cc-mods
/plugin install vp-cc-brief@vp-cc-mods
```

Check a plugin before you commit:

```bash
claude plugin validate .
claude plugin validate plugins/vp-cc-brief
cd plugins/vp-cc-brief && claude plugin test
```

## Conventions

- Every plugin and skill name starts with `vp-cc-`, so it does not collide with other plugins or with skills shared across agents.
- Each plugin lives in `plugins/<name>/` and has an entry in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
- Claude Code writes type declarations into `.claude-plugin/types/` and a `tsconfig.json` inside a mod it loads from disk. Both are ignored.

## License

[MIT](LICENSE)
