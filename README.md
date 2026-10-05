# vp-cc-mods

VdustR's personal collection of Claude Code [mods](https://code.claude.com/docs/en/plugins/mods/overview) and Claude Code-only skills, in one repository that is also a plugin marketplace.

## Why

Mods change how Claude Code itself looks and behaves: they draw above the prompt, add commands, react to turns and tool calls, and call the model. Keeping them in one marketplace means one place to install from, one naming scheme, and one way to test and release them.

- **One install source.** Add the marketplace once, then install only the plugins you want.
- **No name collisions.** Every plugin and skill is prefixed `vp-cc-`, so it never clashes with another plugin or with skills shared across other agents.
- **Small, independent plugins.** Each feature is its own plugin with its own version, README and tests, so you can enable, disable or update one without touching the rest.

## Plugins

| Plugin | Value | Docs |
| :- | :- | :- |
| `vp-cc-recap` | After a break, see the one next step and start it with one keypress. The recap appears above the prompt on demand or after you have been idle. | [README](plugins/vp-cc-recap/README.md) |

## Install

Mods need Claude Code v2.1.287 or later. The Desktop app's bundled engine 2.1.286 also loads them.

1. Add the marketplace:
   ```text
   /plugin marketplace add VdustR/vp-cc-mods
   ```
2. Install a plugin:
   ```text
   /plugin install vp-cc-recap@vp-cc-mods
   ```
3. Check that it loaded: run `/plugin` and open the **Installed** tab.

An install from GitHub is cached by version. To get a change, update the marketplace and the plugin after its `version` increases.

## Develop locally

Add the marketplace from a local clone instead of GitHub. Its plugins then load in place from the clone, and an edit takes effect at the next session start or after `/reload-plugins`, with no version bump:

```text
/plugin marketplace add ~/repo/VdustR/vp-cc-mods
/plugin install vp-cc-recap@vp-cc-mods
```

[AGENTS.md](AGENTS.md) describes the layout, naming rules, checks and release steps for maintaining this repository.

## License

[MIT](LICENSE)
