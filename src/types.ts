export interface ThemeSwitcherConfig {
  /** Hour at which night starts (0-23). Default 23. */
  nightStart?: number;
  /** Hour at which night ends (0-23, inclusive). Default 7. */
  nightEnd?: number;
}

export interface ResolvedThemeSwitcherConfig {
  nightStart: number;
  nightEnd: number;
}

export type ResolvedTheme = "dark" | "light";
