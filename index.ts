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

export default function piThemeSwitcher(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    currentTheme = null; // force re-evaluation on session start
    applyTheme(ctx);

    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    // Poll periodically for time-based changes
    intervalId = setInterval(() => {
      applyTheme(ctx);
    }, POLL_INTERVAL_MS).unref();
  });

  pi.on("session_shutdown", () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    currentTheme = null;
  });
}
