import type { ResolvedTheme, ThemeMode, ThemeSwitcherConfig } from "./types.js";

/**
 * Determines whether a given hour falls within the configured night range.
 *
 * When nightStart <= nightEnd (e.g., 0-6), the range does not wrap around
 * midnight. When nightStart > nightEnd (e.g., 23-7), it does.
 */
export function isInNightRange(
  hour: number,
  nightStart: number,
  nightEnd: number,
): boolean {
  if (nightStart <= nightEnd) {
    return hour >= nightStart && hour <= nightEnd;
  }
  return hour >= nightStart || hour <= nightEnd;
}

/**
 * Resolves the dark/light mode based on precedence:
 *   1. PI_AGENT_THEME env var ("dark" or "light")
 *   2. THEME_MODE env var ("night" → dark, "day" → light)
 *   3. Time-based check against configurable [nightStart, nightEnd]
 */
export function resolveThemeMode(
  config: ThemeSwitcherConfig,
  env: NodeJS.ProcessEnv,
  hour: number,
): ThemeMode {
  // 1. Highest priority: PI_AGENT_THEME
  const agentTheme = env.PI_AGENT_THEME?.trim().toLowerCase();
  if (agentTheme === "dark" || agentTheme === "light") {
    return agentTheme;
  }

  // 2. Second priority: THEME_MODE
  const themeMode = env.THEME_MODE?.trim().toLowerCase();
  if (themeMode === "night") {
    return "dark";
  }
  if (themeMode === "day") {
    return "light";
  }

  // 3. Third priority: time-based
  if (isInNightRange(hour, config.nightStart, config.nightEnd)) {
    return "dark";
  }
  return "light";
}

/**
 * Resolves the theme name to apply. The resolved mode maps to the matching
 * custom theme when the config defines one, otherwise to the built-in
 * "dark" or "light" theme.
 */
export function resolveTheme(
  config: ThemeSwitcherConfig,
  env: NodeJS.ProcessEnv,
  hour: number,
): ResolvedTheme {
  if (resolveThemeMode(config, env, hour) === "dark") {
    return config.darkTheme ?? "dark";
  }
  return config.lightTheme ?? "light";
}
