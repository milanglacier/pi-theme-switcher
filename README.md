# pi-theme-switcher

Pi extension that automatically switches the terminal theme between dark and light based on environment variables, `THEME_MODE`, or time of day.

## Installation

```bash
pi install npm:pi-theme-switcher
```

## How it works

On session start, the extension evaluates the theme in this order:

1. **`PI_AGENT_THEME`** — set to `"dark"` or `"light"` to force a theme
2. **`THEME_MODE`** — set to `"night"` (dark) or `"day"` (light)
3. **Time of day** — fallback to dark/light based on system clock (configurable window)

The extension polls every 60 seconds to handle time-based transitions during long sessions.

## Configuration

Create a config file at `~/.pi/agent/theme-switcher.json` (global) or `.pi/agent/theme-switcher.json` (project-local):

```json
{
  "nightStart": 22,
  "nightEnd": 6
}
```

- `nightStart` (default: `23`, 11 PM) — hour to switch to dark mode
- `nightEnd` (default: `7`, 7 AM) — hour to switch to light mode

Configure both fields together, or omit both to use defaults. A config with only one of these fields is ignored.

When `nightStart > nightEnd` (e.g., 22–6) the night range wraps around midnight. When `nightStart <= nightEnd` (e.g., 0–5), it does not.

Project config overrides global config when it provides both fields.

## License

MIT
