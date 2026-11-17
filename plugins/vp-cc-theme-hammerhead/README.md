# vp-cc-theme-hammerhead

A calm look for the Claude desktop app: Gruvbox colors in dark mode, Everforest colors in light mode, and a hammerhead silhouette cruising a slow sea behind the chat.

## Why

The stock look is neutral by design. This theme gives long sessions a warmer, quieter place to work in:

- **Two palettes, one plugin.** Dark mode uses [Gruvbox](https://github.com/morhetz/gruvbox) and light mode uses [Everforest](https://github.com/sainnhe/everforest). The theme follows the app's own light or dark setting, so there is nothing to switch by hand.
- **Motion that stays out of the way.** One shark swims a wide loop that takes a few minutes, and ribbons of light drift across the water. Nothing blinks, and nothing asks for attention.
- **A different sea each time.** The route, the pace of the tail and the waves are drawn at random when the plugin loads.

## What it looks like

- **Dark mode:** a warm Gruvbox night sea, a pale silhouette, cream ribbons of light.
- **Light mode:** an Everforest lagoon, a dark silhouette, white ribbons of light.
- **The shark:** a pure silhouette seen from above. A wave travels down its body to the tail in a slow S, and its head sweeps the other way, as a hammerhead's does.
- **The panels:** the chat, the sidebar and the side panels are lightly frosted, so the sea shows through them.

## Use

Install the plugin, then start or reload a session in the desktop app:

```text
/plugin install vp-cc-theme-hammerhead@vp-cc-mods
```

There are no commands and no options. To turn the theme off, disable or uninstall the plugin.

It has been checked on Claude Code 2.1.325, the engine bundled with the desktop app at the time of writing. The theme API (`$.theme.set` and the `Backdrop` site) is newer than the first mods release, and the lowest version that has it has not been established.

The theme draws in the Claude desktop and mobile apps. The terminal and the editor extensions draw no look, so the plugin does nothing there and says nothing.

## How it works

- At `session.start` the plugin calls `$.theme.set` with the colors for both modes and a backdrop scene. After `/clear`, which raises no `session.start`, the next prompt sets the theme again.
- A `ui.render` hook on `Backdrop` answers the scene with one SVG. The SVG holds no script; it animates with its own CSS.
- The surface tells a scene nothing about light or dark, so the SVG switches its palette with a `prefers-color-scheme` media query.
- The shark follows a CSS motion path (`offset-path` with `offset-rotate: auto`), so it turns to face where it goes. Its body is a chain of hinged segments that swing on one slow beat, each a little later than the one before.
- The scene is built once per load from a random seed, outside the render hook, so a redraw never moves the shark.
- The plugin reads nothing from the conversation, stores nothing, and sends nothing anywhere.

## Limits

- **One theme per session.** A session has a single theme, and the latest `$.theme.set` wins. Run this plugin with another theme plugin and whichever sets its theme last is the one shown.
- **The scene restarts when the app draws the backdrop again.** The SVG cannot read the clock, so its animation starts over whenever the surface remounts it, for example after a plugin reload. The shark then jumps back to its starting point.
- **Reduced motion.** When the system asks for reduced motion, everything rests in place.
- **Code highlighting.** The theme names `gruvbox-dark-medium` and `everforest-light` as code themes. A surface keeps its own highlighting for a name it does not offer.
- **Contrast.** The palettes are painted as their authors designed them. Some pairs, mostly borders in light mode, fall below the design system's contrast bar.
- **Permission prompts** always keep the app's own look.

## Develop

```bash
node scripts/check.mjs vp-cc-theme-hammerhead
```

The files:

| File | What it holds |
| :- | :- |
| `hooks/register.tsx` | The hooks: set the theme, set it again after `/clear`, draw the backdrop. |
| `hooks/scene.ts` | `buildScene(seed)`: the sea, the shark and the ribbons as one SVG string. |
| `hooks/colors.ts` | The theme's colors. Generated; do not edit by hand. |
| `scripts/build-colors.mjs` | The palette, and the script that writes `hooks/colors.ts` from it. |

To change a color, edit the palette in `scripts/build-colors.mjs` and run it again. It needs `make-colors.js`, which ships inside Claude Code's built-in `plugin-authoring` skill and maps a small palette onto the design system's token names. Run `/plugin-authoring` in a session to have Claude Code write the skill's files and name their folder, then:

```bash
node plugins/vp-cc-theme-hammerhead/scripts/build-colors.mjs <path to make-colors.js>
```

The script refuses a palette that the desktop app would not paint.

To change the art, edit `hooks/scene.ts`. Tests draw the backdrop on the desktop and mobile surfaces and check that it stays one script-free SVG under the engine's size limit; they do not check how it looks, so look at it in the desktop app in both modes before a pull request.
