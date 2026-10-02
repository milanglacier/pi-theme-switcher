import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface ThemeSwitcherConfig {
  /** Hour at which night starts (0-23). */
  nightStart: number;
  /** Hour at which night ends (0-23, inclusive). */
  nightEnd: number;
  /** Theme name to use in dark mode. Defaults to the built-in "dark" theme. */
  darkTheme?: string;
  /** Theme name to use in light mode. Defaults to the built-in "light" theme. */
  lightTheme?: string;
}

export type ThemeMode = "dark" | "light";

/** A pi theme name: a built-in name or a custom theme. */
export type ResolvedTheme = string;

export type ThemeSwitcherContext = ExtensionContext;
