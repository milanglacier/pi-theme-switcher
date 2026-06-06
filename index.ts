import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  getGlobalConfigPath,
  getProjectConfigPath,
  resolveConfig,
} from "./src/config.js";
import { resolveTheme } from "./src/theme.js";
import type { ResolvedTheme, ThemeTarget } from "./src/types.js";

const POLL_INTERVAL_MS = 60_000; // 1 minute

let currentTheme: ResolvedTheme | null = null;
let activeTarget: ThemeTarget | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function determineTheme(cwd?: string): ResolvedTheme {
  const globalPath = getGlobalConfigPath();
  const projectPath = cwd ? getProjectConfigPath(cwd) : null;
  const config = resolveConfig(globalPath, projectPath);
  const hour = new Date().getHours();
  return resolveTheme(config, process.env, hour);
}

function applyTheme(target: ThemeTarget): void {
  const theme = determineTheme(target.cwd);

  if (theme !== currentTheme) {
    currentTheme = theme;
    target.setTheme(theme);
  }
}

function pollTheme(): void {
  const target = activeTarget;
  if (!target) {
    return;
  }

  try {
    applyTheme(target);
  } catch (error) {
    // Timer callbacks are outside pi's event error handling. If the captured
    // theme setter ever becomes unusable, disable this target rather than
    // letting one polling tick crash pi. A later session_start will install a
    // fresh target.
    activeTarget = null;
    currentTheme = null;
    console.warn(
      `[pi-theme-switcher] Theme polling disabled: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default function piThemeSwitcher(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    // Do not keep ctx itself: pi invalidates old ctx objects after reload or
    // session replacement. Keep a tiny per-session target instead, and make the
    // timer look up the current target each tick.
    const cwd = ctx.cwd;
    const ui = ctx.ui;

    activeTarget = {
      cwd,
      setTheme: ui.setTheme.bind(ui),
    };

    currentTheme = null; // force re-evaluation on session start
    applyTheme(activeTarget);

    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    // Poll periodically for time-based changes.
    intervalId = setInterval(pollTheme, POLL_INTERVAL_MS).unref();
  });

  pi.on("session_shutdown", () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    activeTarget = null;
    currentTheme = null;
  });
}
