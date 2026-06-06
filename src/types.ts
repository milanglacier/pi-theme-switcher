import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface ThemeSwitcherConfig {
  /** Hour at which night starts (0-23). */
  nightStart: number;
  /** Hour at which night ends (0-23, inclusive). */
  nightEnd: number;
}

export type ResolvedTheme = "dark" | "light";

export type ThemeSwitcherContext = ExtensionContext;
