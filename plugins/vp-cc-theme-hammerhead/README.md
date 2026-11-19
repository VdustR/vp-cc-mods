# vp-cc-theme-hammerhead

A calm look for the Claude desktop app, built from any terminal color scheme: one scheme for dark mode and one for light, and a hammerhead silhouette cruising a slow sea behind the chat.

## Why

The stock look is neutral by design. This theme gives long sessions a warmer, quieter place to work in, in the colors you already use in your terminal:

- **Your scheme, both modes.** Pick a scheme for dark mode and another for light mode. The theme follows the app's own appearance setting, so there is nothing to switch by hand. It starts with [Gruvbox](https://github.com/morhetz/gruvbox) Dark and [Catppuccin](https://github.com/catppuccin/catppuccin) Latte.
- **The terminal format, nothing new to learn.** A scheme is the 20 colors of a terminal theme, in the Windows Terminal format that [iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes) publishes for every scheme it collects. Paste one, or describe one in a few words and Claude writes it.
- **One set of rules for every scheme.** The app's surfaces, its text, the water, the ribbons and the shark are all worked out from the scheme to fixed contrast targets, so the waves and the words are as clear on a pale scheme as on a black one.
- **A sea that answers you.** While the pointer moves the shark turns toward it, and a click sends a ring across the water.
- **Motion that stays out of the way, and light on the processor.** One shark swims a loop around the middle of the conversation that takes a few minutes, curving through its turns, and the water winds slowly under drifting light. In the desktop app it plays on the GPU, where the SVG sea was redrawn by the processor every frame; how much that saves has not been measured. Nothing blinks, and nothing asks for attention.

## What it looks like

- **The app:** the page takes the scheme's background, and cards, panels and menus step away from it by a small, fixed amount. Buttons and links take the scheme's accent; red, green, yellow and purple color errors, successes, warnings and the rest.
- **The sea:** shades of the scheme's background, never a hue it does not have. The ribbons are always the lighter of the two, as light on water is. On a dark scheme the water is the background and the ribbons are a lighter shade of it. On a light scheme, which has no room above its background, the ribbons are the background and the water is a darker shade of it. **Depth** sets how far apart they are. Each ribbon's crest line fades in and out along its length, and the glints drift a little with the water.
- **The shark:** a symmetric silhouette seen from straight above, a shade further from the water: paler on a dark scheme, darker on a light one. Line art inside it, a shade the other way from the water, draws the ridge of its head, its gill slits, its spine and the edges of its fins. Its head is a broad hammer whose front edge waves between the nose and two rounded eye lobes. Its pectoral fins are long swept blades, its pelvic fins small ones, and its tail an upright blade, narrow from above: a long upper lobe over a shorter lower one. A wave travels down its body to the tail in a slow S, its head sweeps the other way, and the tail's two lobes swing apart as it sweeps, as a blade the water leans over shows one lobe to each side, and close again as it stands up. It banks into its turns: the pectoral fin on the inside of a turn shortens and the one on the outside lengthens.

## Use

Install the plugin, then start or reload a session in the desktop app:

```text
/plugin install vp-cc-theme-hammerhead@vp-cc-mods
```

Open the settings pane with:

```text
/vp-cc-theme-hammerhead
```

Every change is drawn at once and kept for every session on the machine. Another open session draws it at its next prompt.

The pane is in sections: **Schemes**, **Your own scheme**, **The sea**, **The shark** and **The app**. Press a heading to open or close its section; a closed one says in a line what it holds. What the last action came to is said under the mode buttons, above every section; an answer to what you typed is said beside the input. A button that steps a value is dimmed once the value has reached its limit. Each of the last three has its own reset. The pane opens as it was left: on the mode you were choosing for, with the same sections open.

| In the pane | What it does |
| :- | :- |
| **Dark** and **Light** | Choose which mode's scheme the list below sets. |
| The scheme list | The shipped schemes for that mode, then your own. Each row shows the scheme's colors, then its water, its ribbons and its shark. Press one to use it. |
| **Your own scheme** | Type a few words (`warm coffee and cream, low contrast`) and press Enter: Claude writes a scheme for the chosen mode. Or paste a scheme as JSON. It is kept in the list, where **Remove** deletes it, and a button then puts it back until the next change. To change one of yours, paste it again under the same name. When Claude does not answer with a scheme, **Try again** asks once more. |
| **Show as JSON** | Shows the chosen scheme in the terminal format, to copy, edit and paste back. |
| **Backdrop** | **Moving** is the sea in motion (on the GPU in the desktop app), **Still** the sea at rest, **Plain** the scheme's background alone, with no sea, shark or glass. |
| **Blur** | How far the sea blurs behind the conversation, 0 to 24. Starts at 3. |
| **Veil** | How opaque the app's own panel color lies over the sea, 0% to 80%. Starts at 70%. A message bubble is a panel: a thick veil makes bubbles solid, a thin one leaves them see-through. With both at 0 the sea is bare. |
| **Depth** | How far the water and its ribbons are apart, 1 (barely there) to 10 (deep). The default is 3. |
| **Waves** | Three, five or seven ribbons. |
| **Wave speed** | How fast the ribbons drift, 50% to 200% of their own pace. |
| **Glints** | How many specks of light twinkle on the water: 0, 10, 22 or 40. |
| **Shark** | Shows or hides the shark. **New route** sends it another way. |
| **Shark tone** | How far the shark stands out from the water, 1 (faint) to 10 (bold). The default is 4. |
| **Shark size** and **Swim speed** | 50% to 200% of its own, in steps of 25. In the desktop app the shark's own pace crosses the window in well under a minute. |
| **While Claude works** | **The sea hurries**: while Claude works on a turn, the shark swims two and a half times as fast and the water flows three times as fast, easing in and out. **Keeps its pace** turns that off. The SVG sea, in the mobile app, keeps its pace. |
| **Layers** | How far cards, panels and menus step away from the page, 0 (flat) to 6. The default is 2. |
| **Accent** | The color of buttons, links and switches: the scheme's own choice, or the scheme's red, yellow, green, cyan, blue or purple. |
| **Use the scheme's code theme** | On, code takes the highlighting theme that matches the scheme. Off, the app keeps the code theme chosen in its Appearance settings. |
| **Stronger borders** | Asks the app for stronger borders and focus rings. |
| **Reset everything** | Back to Gruvbox Dark and Catppuccin Latte with the standard sea. Your own schemes are kept. |

### Shipped schemes

| Dark mode | Light mode |
| :- | :- |
| Gruvbox Dark | Gruvbox Light |
| Everforest Dark | Everforest Light |
| Catppuccin Mocha | Catppuccin Latte |
| Tokyo Night | Tokyo Night Day |
| Nord | Nord Light |
| Rose Pine | Rose Pine Dawn |
| Solarized Dark | Solarized Light |
| Dracula | |

### Your own scheme

A scheme is one JSON object. Take any file from the `windowsterminal` folder of [iTerm2-Color-Schemes](https://github.com/mbadolato/iTerm2-Color-Schemes), or write your own:

```json
{
  "name": "Ember",
  "background": "#1b1412", "foreground": "#f2e3d5", "cursorColor": "#ff8a4c", "selectionBackground": "#4a342c",
  "black": "#1b1412", "red": "#e5604d", "green": "#9fb86a", "yellow": "#e8b25c",
  "blue": "#6fa3c7", "purple": "#b98bc9", "cyan": "#6fbfb2", "white": "#d9c7b8",
  "brightBlack": "#6b554b", "brightRed": "#f27d6b", "brightGreen": "#b7cf85", "brightYellow": "#f4c97a",
  "brightBlue": "#8dbbe0", "brightPurple": "#cfa5dd", "brightCyan": "#8fd6ca", "brightWhite": "#fbf1e6",
  "accent": "#ff8a4c"
}
```

- Every color is six-digit hex. The 16 colors are required; `background` falls back to `black`, `foreground` to `brightWhite`.
- A scheme belongs to the mode its background is in: a dark background makes it a dark-mode scheme, whichever mode you were choosing for.
- Two optional keys are not part of the terminal format:
  - `accent`: the color of buttons, links and switches. Without it the cursor color is used when it is a color and not a gray, else blue.
  - `codeTheme`: the name of the app's own code highlighting theme that goes with the scheme, such as `dracula` or `catppuccin-latte`. The names are the ones the [Shiki](https://shiki.style/themes) themes carry; the app keeps its own choice for a name it does not offer. Without it, code is colored from the scheme's red, green, yellow and purple.
- The nested form that [term-ptt-custom-theme](https://github.com/VdustR/term-ptt-custom-theme) writes (`scheme` and `metadata`) is read too.

It has been checked on Claude Code 2.1.326, the engine bundled with the desktop app at the time of writing. On 2.1.326 and later the desktop app plays the moving sea on the GPU; an older engine, such as 2.1.325, has no shaders and draws the SVG sea that moves with CSS instead. The theme API (`$.theme.set` and the `Backdrop` site) is newer than the first mods release, and the lowest version that has it has not been established.

The theme draws in the Claude desktop and mobile apps. The terminal and the editor extensions draw no look, so the plugin sets nothing there and says nothing; the settings pane still opens.

## How it works

- At `session.start` the plugin reads its settings from `$.store`, works out the look and calls `$.theme.set` with the colors for both modes and a backdrop scene. After `/clear`, which raises no `session.start`, the next prompt sets the theme again.
- The app's colors come from the design system's own builder, `make-colors.js`, which ships inside Claude Code's `plugin-authoring` skill and is copied here unchanged. The plugin gives it a few colors a mode and it names the hundred the app needs.
- The Desktop app ignores a whole theme when one piece of text falls under its contrast floor. A scheme that would fail is eased until it passes, and each complaint says how: text too dim on one of the app's own highlights is pushed further from the background, otherwise the surfaces are flattened, and then the one role color at fault is left to the app's own. Saving a scheme of your own says what was eased. Of the 912 schemes in iTerm2-Color-Schemes, 890 are painted; the other 22 have a background between dark and light, which the app paints in neither mode, and saving one says so.
- The sea's shades are the background moved lighter or darker in OKLCH, with its hue and chroma kept, until they reach a set contrast: 1.1 at depth 1 to 2.0 at depth 10 for the ribbons, and 1.5 at tone 1 to 4.2 at tone 10 for the shark. Mixing in the foreground instead grays a warm background, since a scheme's text is rarely its background's hue.
- Text is held to 7:1 on the worst ground it is read on: the page, a card, the water, the water under a ribbon, and a filled control on a menu.
- A `ui.render` hook on `Backdrop` answers the scene. The surface tells a scene nothing about light or dark, so its SVG carries both modes' palettes and switches with a `prefers-color-scheme` media query.
- **The moving sea in the desktop app is a GPU shader**, `hooks/sea.ts`, played over the still sea. An SVG that animates is drawn again by the processor every frame, and anything that moves costs about as much as the whole sea, so the motion is the shader's:
  - The water: the shader reads the still sea's picture (the water, its glow and its glints) and bends it with a few crossing sine waves, each bent by another; a slow, layered light drifts over it. The ribbons are the shader's own, drawn as the SVG draws them, each drifting sideways at 8 to 20 units a second and rising and falling on a period of 14 to 32 seconds. Their soft bands are worked out on a coarse grid and their thin crests at full sharpness.
  - The glints: the still sea's specks hold still under a shader, so the shader finds them, as pixels that differ from the water six points to either side, and fades each in and out on its own eleven-second clock, as the SVG's do.
  - A click sends a ring out across the water from where it was pressed, light on its crest and shade in its trough, running out at 220 units a second and fading over two and a half seconds. The last four are kept on the GPU; a fifth replaces the oldest. The rings light the water and do not move it, which keeps them cheap.
  - The route: the shark swims free. Each frame it moves ahead at its pace and turns toward the turn it wants: a slow, random wandering, and a turn back toward the middle as it nears the edge of the conversation. Its pace never changes, and how fast it turns changes by at most 0.5 radians a second each second, so it swings into a turn and out of it.
  - The pointer makes it curious, not chained: while the pointer moves its interest grows over a second and a half, and it fades over four once the pointer stops. It heads for a place that drifts after the pointer a second behind, turns toward it no faster than 0.6 radians a second, judges it from its head: within about 200 units of the head it loses interest and passes by to loop back, beyond 500 its interest fades to half, and behind its eyeline to half again, and keeps a fifth of its own wandering even at its keenest.
  - The shark: triangles cut from the same paths the SVG draws (`scripts/mesh.mjs` writes them into `hooks/sea.ts`), laid on one spine. The spine's shape comes from one curvature, summed from the pectorals out: a share of the route's own turn, so the body arcs into a turn, and a wave that runs from the head down to the tail, small at the head and wide at the tail, and wider in a turn. The whole spine is then turned so that the body as a whole keeps to the route, which swings the head against the tail, as a fish's does. The head and the pectorals stay rigid, each riding the spine at one point; the pectorals bank into turns, and the tail's two lobes swing opposite ways as it sweeps. The mesh holds the right half of the shark, and each pass draws it twice, once mirrored, since the whole shark with its line art would not fit in a shader's 16,384 bits of numbers. The line art is drawn in a pass of its own over the silhouette.
  - Its colors: a shader is told nothing about light or dark either, so the shark, its line art and its shadow are shades of the water under them, worked out per pixel: the shark paler on dark water and darker on light water, its lines the other way.
  - Its clocks are stepped each frame by distance: its tail beats once for every half body length it swims, so a faster shark beats faster and never looks as if it labors. The hurry while Claude works eases in and out, and the shark swims on from where it is.
  - While Claude works on a turn of the main conversation (`turn.start` to `turn.complete`), the plugin raises one shader value, `rush`, and asks for the backdrop again. Only a value changes, so the shader keeps running and eases to it.
- Where the GPU sea is not played, the SVG moves by itself: in the mobile app, on an engine without shaders, and when the app holds a shader back (as it does for one that runs too slowly). The shark there follows a CSS motion path (`offset-path` with `offset-rotate: auto`), so it turns to face where it goes. Its body is a chain of hinged segments that swing on one slow beat, each a little later than the one before. The tail fin is two lobes hinged on the end of the stalk, swinging opposite ways on that beat: a blade the water leans over shows its upper lobe to one side and its lower lobe to the other.
- The shark's bank is baked from its route: the route is walked in small pieces, how hard it turns is measured at 40 equal steps of its length, and those become the keyframes of the two pectoral fins, run on the same clock as the lap.
- The SVG sea is built when the look is set, and the still one under the shader when the desktop app first asks for it, both from a random seed kept for the load, so a redraw never moves the SVG shark. A surface draws a backdrop again only for a scene name it has not drawn, so each look names its scene with the load's seed and a count.
- When you describe a scheme in words, those words go to Claude in one model call that sees nothing of the conversation. Nothing else is sent anywhere.

## Limits

- **One theme per session.** A session has a single theme, and the latest `$.theme.set` wins. Run this plugin with another theme plugin and whichever sets its theme last is the one shown.
- **The appearance setting is the app's.** The plugin cannot tell or change whether the app is in light or dark mode; the pane opens on dark mode's schemes.
- **The scene restarts when the sea changes.** The SVG cannot read the clock, so its animation starts over whenever it is drawn again, and the shark jumps back to its starting point: after a change to the sea, the shark, the glass or the scheme, and after a plugin reload. A change that leaves the drawing alone (layers, accent, code theme, contrast, a step past its limit) keeps the sea as it is. In the desktop app the GPU sea starts over in the same way: the shark goes back to where it starts. Only the hurry while Claude works changes without a restart.
- **Other sessions catch up later.** Settings are shared, but a session already open draws a change made elsewhere only when it next sets its theme: on a reload, a `/clear`, or a change in its own pane.
- **Reduced motion.** When the system asks for reduced motion, everything rests in place: the app shows the still sea alone, with its shark at rest.
- **Two kinds of motion.** The GPU sea and the SVG sea swim differently: only the GPU shark swims free, follows the pointer and bends through its turns; the SVG shark swims a fixed loop. **New route** gives the SVG shark a new loop, and the GPU shark a new start and a new way of wandering. The mobile app and engines older than 2.1.326 show the SVG sea.
- **The pointer may wake late.** In the desktop app the shark may take no notice of the pointer, and a click may be slow to ring, until the first message of the session; the backdrop is drawn again then. The cause is not known.
- **The SVG stays, still.** A shader wraps one SVG, which the app shows when it cannot play the shader. Under the shader that SVG holds no animation, so the app draws it once and the processor does nothing for it after that.
- **The GPU sea needs a GPU the app trusts.** The app holds back a shader that fails or runs too slowly and shows the still sea under it in its place, which a hook cannot tell apart from the sea in motion. That still sea has no shark and no ribbons of its own, since the shader draws them: it is the water, its glow and its glints.
- **Code highlighting.** A shipped scheme names its matching code theme, which takes the place of the one chosen in the app's Appearance settings while the theme is on; **Use the scheme's code theme** turns that off. Tokyo Night Day and Nord Light have no matching theme and color code from the scheme itself.
- **Not adjustable:** corner radius, fonts, shadows and spacing. A theme is colors, the backdrop and its glass.
- **Bubbles cannot be styled on their own.** A message bubble is one of the app's panels, so blur and veil change every panel together, and a veil's color is the app's own. A tint is not offered: it is one raw color for both modes and could not follow light and dark.
- **The pane is in English.** Its labels are not translated.
- **Permission prompts** always keep the app's own look.

## Develop

```bash
node scripts/check.mjs vp-cc-theme-hammerhead
```

The files:

| File | What it holds |
| :- | :- |
| `hooks/register.tsx` | The hooks, the settings pane and the slash command |
| `hooks/presets.ts` | The shipped schemes and the default pair |
| `hooks/scheme.ts` | Reading a scheme a person pasted or the model wrote |
| `hooks/look.ts` | From a scheme to the app's colors and the sea's |
| `hooks/scene.ts` | The sea, the ribbons and the shark as one SVG |
| `hooks/sea.ts` | The moving sea and the shark as a GPU shader, with the shark's mesh |
| `scripts/mesh.mjs` | Cuts the shark's paths in `hooks/scene.ts` into the mesh in `hooks/sea.ts`; run it after changing a path |
| `hooks/settings.ts` | What can be chosen, with its defaults and limits |
| `hooks/color.ts` | Contrast, mixing and OKLCH |
| `hooks/make-colors.js` | The design system's color builder, copied unchanged; copy it again when Claude Code updates |
| `types/index.d.ts` | The scheme format and the `$.state` contract |

To add a shipped scheme, add its Windows Terminal JSON to `hooks/presets.ts`. The tests then hold it to the same bar as the rest: the Desktop app must paint it, and its waves, shark and text must reach their contrast targets.

Check any change to the look in the desktop app in both modes, as [AGENTS.md](../../AGENTS.md) describes: the tests do not paint.
