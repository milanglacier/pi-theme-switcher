import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  getGlobalConfigPath,
  getProjectConfigPath,
  resolveConfig,
} from "./src/config.js";
import { resolveTheme } from "./src/theme.js";
import type { ResolvedTheme, ThemeSwitcherContext } from "./src/types.js";

const POLL_INTERVAL_MS = 60_000; // 1 minute

let currentTheme: ResolvedTheme | null = null;
let activeContext: ThemeSwitcherContext | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function determineTheme(cwd?: string): ResolvedTheme {
  const globalPath = getGlobalConfigPath();
  const projectPath = cwd ? getProjectConfigPath(cwd) : null;
  const config = resolveConfig(globalPath, projectPath);
  const hour = new Date().getHours();
  return resolveTheme(config, process.env, hour);
}

function applyTheme(ctx: ThemeSwitcherContext): void {
  const theme = determineTheme(ctx.cwd);

  if (theme !== currentTheme) {
    currentTheme = theme;
    ctx.ui.setTheme(theme);
  }
}

function isTuiSession(ctx: ThemeSwitcherContext): boolean {
  const mode = (ctx as ThemeSwitcherContext & { mode?: string }).mode;
  if (mode !== undefined) {
    return mode === "tui";
  }

  // Compatibility with older pi versions whose ExtensionContext did not expose
  // ctx.mode and where ctx.hasUI only meant the interactive terminal UI.
  return ctx.hasUI;
}

function clearPolling(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function pollTheme(): void {
  const ctx = activeContext;
  if (!ctx) {
    return;
  }

  try {
    applyTheme(ctx);
  } catch (error) {
    // Timer callbacks are outside pi's event error handling. If the ctx has
    // gone stale after reload/session replacement, or the theme switch fails,
    // disable polling instead of letting one tick crash pi. A later
    // session_start will install a fresh ctx.
    clearPolling();
    activeContext = null;
    currentTheme = null;
    console.warn(
      `[pi-theme-switcher] Theme polling disabled: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default function piThemeSwitcher(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    // Theme switching requires a real terminal TUI. In RPC, print, and JSON
    // modes, setTheme is unsupported or meaningless, so leave the session alone.
    if (!isTuiSession(ctx)) {
      clearPolling();
      activeContext = null;
      currentTheme = null;
      return;
    }

    // Use the live ctx while it remains valid. If Pi later invalidates it after
    // reload/session replacement, the next polling tick catches that stale-ctx
    // error and disables this timer instead of bypassing the ctx lifetime guard.
    clearPolling();
    activeContext = ctx;

    currentTheme = null; // force re-evaluation on session start
    applyTheme(ctx);

    // Poll periodically for time-based changes.
    intervalId = setInterval(pollTheme, POLL_INTERVAL_MS).unref();
  });

  pi.on("session_shutdown", () => {
    clearPolling();
    activeContext = null;
    currentTheme = null;
  });
}
