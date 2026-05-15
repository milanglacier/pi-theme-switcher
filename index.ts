import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  getGlobalConfigPath,
  getProjectConfigPath,
  resolveConfig,
  type ResolvedConfig,
} from "./src/config.js";
import { resolveTheme } from "./src/theme.js";
import type { ResolvedTheme } from "./src/types.js";

const POLL_INTERVAL_MS = 60_000; // 1 minute

let cachedConfig: ResolvedConfig | null = null;
let cachedCwd: string | undefined;
let currentTheme: ResolvedTheme | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function loadConfig(cwd?: string): ResolvedConfig {
  const globalPath = getGlobalConfigPath();
  const projectPath = cwd ? getProjectConfigPath(cwd) : null;

  const resolved = resolveConfig(globalPath, projectPath);
  const stamp = resolved.stamp;

  if (cachedConfig && cachedCwd === cwd && cachedConfig.stamp === stamp) {
    return cachedConfig;
  }

  cachedConfig = resolved;
  cachedCwd = cwd;
  return cachedConfig;
}

function determineTheme(cwd?: string): ResolvedTheme {
  const config = loadConfig(cwd);
  const hour = new Date().getHours();
  return resolveTheme(config, process.env, hour);
}

function applyTheme(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]): void {
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
    cachedConfig = null;
    cachedCwd = undefined;
  });
}
