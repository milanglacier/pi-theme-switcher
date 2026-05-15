# pi-theme-switcher

Pi extension that automatically switches the terminal theme between dark and light based on environment variables, `THEME_MODE`, or time of day.

## Installation

```bash
pi install npm:pi-theme-switcher
```

## How it works

On session start, the extension evaluates the theme in this order:

1. **`PI_AGENT_THEME`** or **`THEME_MODE`** environment variable
2. **Time of day** — fallback to dark/light based on system clock (configurable window)

The extension polls every 60 seconds to handle time-based transitions during long sessions.

## Configuration

Create a config file at `~/.pi/agent/theme-switcher.json` (global) or `.pi/theme-switcher.json` (project-local):

```json
{
  "darkStart": 18,
  "darkEnd": 6
}
```

- `darkStart` (default: `23`, 11 PM) — hour to switch to dark mode
- `darkEnd` (default: `7`, 7 AM) — hour to switch to light mode

Project config overrides global config.

## License

MIT
