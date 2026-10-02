# pi-theme-switcher

Pi extension that automatically switches the terminal theme between dark and light based on environment variables, `THEME_MODE`, or time of day. Each mode can use a custom theme instead of the built-in `dark`/`light` themes.

## Installation

```bash
pi install npm:pi-theme-switcher
```

## How it works

On TUI session start, the extension evaluates the theme in this order:

1. **`PI_AGENT_THEME`** — set to `"dark"` or `"light"` to force a theme
2. **`THEME_MODE`** — set to `"night"` (dark) or `"day"` (light)
3. **Time of day** — fallback to dark/light based on system clock (configurable window)

The extension polls every 60 seconds to handle time-based transitions during long TUI sessions. It does not run in RPC, print, or JSON sessions where no terminal TUI theme can be changed.

## Configuration

Create a config file at `~/.pi/agent/theme-switcher.json` (global) or `.pi/agent/theme-switcher.json` (project-local):

```json
{
  "nightStart": 22,
  "nightEnd": 6,
  "darkTheme": "rosepine",
  "lightTheme": "rosepine_dawn"
}
```

- `nightStart` (default: `23`, 11 PM) — hour to switch to dark mode
- `nightEnd` (default: `7`, 7 AM) — hour to switch to light mode
- `darkTheme` (optional) — theme to use in dark mode instead of the built-in `dark` theme
- `lightTheme` (optional) — theme to use in light mode instead of the built-in `light` theme

Configure both `nightStart` and `nightEnd` together, or omit both to use defaults. A config with only one of these fields is ignored. When `nightStart > nightEnd` (e.g., 22–6) the night range wraps around midnight. When `nightStart <= nightEnd` (e.g., 0–5), it does not.

The `darkTheme` and `lightTheme` fields are independent and optional. Each falls back to the built-in `dark` or `light` theme when omitted. The environment variables still select the dark/light mode; the mode is then mapped through this config. For example, with the config above, `PI_AGENT_THEME=light` applies `rosepine_dawn` rather than `light`.

Theme names refer to any theme available in Pi, including custom themes from `~/.pi/agent/themes/`, project `.pi/themes/`, or packages. See [Customize Pi with themes](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/themes.md).

If a custom theme cannot be loaded, the extension applies the built-in theme for the selected mode (`dark` or `light`). It retries the custom theme on later polling ticks.

A config may contain only theme fields; the default night range then applies.

Project config overrides global config when the config file is valid.

## License

MIT
