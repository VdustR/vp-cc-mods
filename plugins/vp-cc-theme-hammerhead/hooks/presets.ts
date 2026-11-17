// The schemes this plugin ships: a few well-known pairs, each in the Windows Terminal scheme format that
// mbadolato/iTerm2-Color-Schemes publishes, the format a person's own scheme takes too. Their colors are their
// authors': Gruvbox (morhetz), Everforest (sainnhe), Catppuccin, Tokyo Night (enkia, folke), Nord (Arctic Ice Studio),
// Rose Pine, Dracula and Solarized (Ethan Schoonover). The accent and codeTheme keys are this plugin's additions: each scheme's signature color, and the name of the app's code highlighting theme that matches it.

import type { Scheme } from '../types'

export const PRESETS: readonly Scheme[] = [
  {
    name: 'Gruvbox Dark',
    accent: '#fe8019',
    codeTheme: 'gruvbox-dark-medium',
    background: '#282828', foreground: '#ebdbb2', cursorColor: '#ebdbb2', selectionBackground: '#665c54',
    black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', purple: '#b16286', cyan: '#689d6a', white: '#a89984',
    brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f', brightBlue: '#83a598', brightPurple: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2',
  },
  {
    name: 'Gruvbox Light',
    accent: '#af3a03',
    codeTheme: 'gruvbox-light-medium',
    background: '#fbf1c7', foreground: '#3c3836', cursorColor: '#3c3836', selectionBackground: '#3c3836',
    black: '#fbf1c7', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', purple: '#b16286', cyan: '#689d6a', white: '#7c6f64',
    brightBlack: '#928374', brightRed: '#9d0006', brightGreen: '#79740e', brightYellow: '#b57614', brightBlue: '#076678', brightPurple: '#8f3f71', brightCyan: '#427b58', brightWhite: '#3c3836',
  },
  {
    name: 'Everforest Dark',
    accent: '#a7c080',
    codeTheme: 'everforest-dark',
    background: '#232a2e', foreground: '#d3c6aa', cursorColor: '#e69875', selectionBackground: '#543a48',
    black: '#7a8478', red: '#e67e80', green: '#a7c080', yellow: '#dbbc7f', blue: '#7fbbb3', purple: '#d699b6', cyan: '#83c092', white: '#f2efdf',
    brightBlack: '#a6b0a0', brightRed: '#f85552', brightGreen: '#8da101', brightYellow: '#dfa000', brightBlue: '#3a94c5', brightPurple: '#df69ba', brightCyan: '#35a77c', brightWhite: '#fffbef',
  },
  {
    name: 'Everforest Light',
    accent: '#35a77c',
    codeTheme: 'everforest-light',
    background: '#efebd4', foreground: '#5c6a72', cursorColor: '#f57d26', selectionBackground: '#eaedc8',
    black: '#7a8478', red: '#e67e80', green: '#9ab373', yellow: '#c1a266', blue: '#7fbbb3', purple: '#d699b6', cyan: '#83c092', white: '#b2af9f',
    brightBlack: '#a6b0a0', brightRed: '#f85552', brightGreen: '#8da101', brightYellow: '#dfa000', brightBlue: '#3a94c5', brightPurple: '#df69ba', brightCyan: '#35a77c', brightWhite: '#fffbef',
  },
  {
    name: 'Catppuccin Mocha',
    accent: '#cba6f7',
    codeTheme: 'catppuccin-mocha',
    background: '#1e1e2e', foreground: '#cdd6f4', cursorColor: '#f5e0dc', selectionBackground: '#f5e0dc',
    black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af', blue: '#89b4fa', purple: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
    brightBlack: '#585b70', brightRed: '#f7aec2', brightGreen: '#c2ecbf', brightYellow: '#fcd682', brightBlue: '#aeccfc', brightPurple: '#f398da', brightCyan: '#b1eae1', brightWhite: '#a6adc8',
  },
  {
    name: 'Catppuccin Latte',
    accent: '#8839ef',
    codeTheme: 'catppuccin-latte',
    background: '#eff1f5', foreground: '#4c4f69', cursorColor: '#dc8a78', selectionBackground: '#dc8a78',
    black: '#bcc0cc', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d', blue: '#1e66f5', purple: '#ea76cb', cyan: '#179299', white: '#5c5f77',
    brightBlack: '#acb0be', brightRed: '#e7103f', brightGreen: '#46b02f', brightYellow: '#e49931', brightBlue: '#3878f6', brightPurple: '#ef95d7', brightCyan: '#19a1a8', brightWhite: '#6c6f85',
  },
  {
    name: 'Tokyo Night',
    codeTheme: 'tokyo-night',
    background: '#1a1b26', foreground: '#c0caf5', cursorColor: '#c0caf5', selectionBackground: '#33467c',
    black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', purple: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
    brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightPurple: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5',
  },
  {
    name: 'Tokyo Night Day',
    background: '#e1e2e7', foreground: '#3760bf', cursorColor: '#3760bf', selectionBackground: '#99a7df',
    black: '#e9e9ed', red: '#f52a65', green: '#587539', yellow: '#8c6c3e', blue: '#2e7de9', purple: '#9854f1', cyan: '#007197', white: '#6172b0',
    brightBlack: '#a1a6c5', brightRed: '#f52a65', brightGreen: '#587539', brightYellow: '#8c6c3e', brightBlue: '#2e7de9', brightPurple: '#9854f1', brightCyan: '#007197', brightWhite: '#3760bf',
  },
  {
    name: 'Nord',
    accent: '#88c0d0',
    codeTheme: 'nord',
    background: '#2e3440', foreground: '#d8dee9', cursorColor: '#eceff4', selectionBackground: '#eceff4',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', purple: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#596377', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightPurple: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4',
  },
  {
    name: 'Nord Light',
    accent: '#5e81ac',
    background: '#e5e9f0', foreground: '#414858', cursorColor: '#7bb3c3', selectionBackground: '#d8dee9',
    black: '#3b4252', red: '#bf616a', green: '#96b17f', yellow: '#c5a565', blue: '#81a1c1', purple: '#b48ead', cyan: '#7bb3c3', white: '#a5abb6',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#96b17f', brightYellow: '#c5a565', brightBlue: '#81a1c1', brightPurple: '#b48ead', brightCyan: '#82afae', brightWhite: '#eceff4',
  },
  {
    name: 'Rose Pine',
    accent: '#c4a7e7',
    codeTheme: 'rose-pine',
    background: '#191724', foreground: '#e0def4', cursorColor: '#e0def4', selectionBackground: '#403d52',
    black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177', blue: '#9ccfd8', purple: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4',
    brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#31748f', brightYellow: '#f6c177', brightBlue: '#9ccfd8', brightPurple: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4',
  },
  {
    name: 'Rose Pine Dawn',
    accent: '#907aa9',
    codeTheme: 'rose-pine-dawn',
    background: '#faf4ed', foreground: '#575279', cursorColor: '#575279', selectionBackground: '#dfdad9',
    black: '#f2e9e1', red: '#b4637a', green: '#286983', yellow: '#ea9d34', blue: '#56949f', purple: '#907aa9', cyan: '#d7827e', white: '#575279',
    brightBlack: '#9893a5', brightRed: '#b4637a', brightGreen: '#286983', brightYellow: '#ea9d34', brightBlue: '#56949f', brightPurple: '#907aa9', brightCyan: '#d7827e', brightWhite: '#575279',
  },
  {
    name: 'Dracula',
    accent: '#bd93f9',
    codeTheme: 'dracula',
    background: '#282a36', foreground: '#f8f8f2', cursorColor: '#f8f8f2', selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', purple: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5', brightBlue: '#d6acff', brightPurple: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  {
    name: 'Solarized Dark',
    codeTheme: 'solarized-dark',
    background: '#002b36', foreground: '#839496', cursorColor: '#839496', selectionBackground: '#073642',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', purple: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83', brightBlue: '#839496', brightPurple: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  },
  {
    name: 'Solarized Light',
    codeTheme: 'solarized-light',
    background: '#fdf6e3', foreground: '#657b83', cursorColor: '#657b83', selectionBackground: '#eee8d5',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', purple: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83', brightBlue: '#839496', brightPurple: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  },
]

/** The scheme each mode starts with. */
export const DEFAULTS = { dark: 'Gruvbox Dark', light: 'Everforest Light' } as const
