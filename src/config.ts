import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { ThemeSwitcherConfig } from "./types.js";

export const DEFAULT_NIGHT_START = 23;
export const DEFAULT_NIGHT_END = 7;

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function getGlobalConfigPath(): string {
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "theme-switcher.json");
}

export function getProjectConfigPath(cwd: string): string {
  return join(cwd, ".pi", "agent", "theme-switcher.json");
}

function isValidHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

function parseThemeName(value: unknown, field: string, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string in '${path}'`);
  }

  return value.trim();
}

function parseConfig(raw: string, path: string): ThemeSwitcherConfig | null {
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`expected a JSON object in '${path}'`);
  }

  const record = parsed as Record<string, unknown>;
  const hasNightStart = record.nightStart !== undefined;
  const hasNightEnd = record.nightEnd !== undefined;
  const darkTheme = parseThemeName(record.darkTheme, "darkTheme", path);
  const lightTheme = parseThemeName(record.lightTheme, "lightTheme", path);

  if (!hasNightStart && !hasNightEnd && darkTheme === undefined && lightTheme === undefined) {
    return null;
  }

  let nightStart = DEFAULT_NIGHT_START;
  let nightEnd = DEFAULT_NIGHT_END;

  if (hasNightStart || hasNightEnd) {
    if (hasNightStart !== hasNightEnd) {
      throw new Error(`nightStart and nightEnd must be configured together in '${path}'`);
    }

    if (!isValidHour(record.nightStart) || !isValidHour(record.nightEnd)) {
      throw new Error(`nightStart and nightEnd must be integers from 0 to 23 in '${path}'`);
    }

    nightStart = record.nightStart;
    nightEnd = record.nightEnd;
  }

  const config: ThemeSwitcherConfig = { nightStart, nightEnd };
  if (darkTheme !== undefined) {
    config.darkTheme = darkTheme;
  }
  if (lightTheme !== undefined) {
    config.lightTheme = lightTheme;
  }
  return config;
}

function readConfig(
  path: string | null,
  onWarning?: (message: string) => void,
): ThemeSwitcherConfig | null {
  if (!path) {
    return null;
  }

  try {
    return parseConfig(readFileSync(path, "utf-8"), path);
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }

    const message = error instanceof Error ? error.message : String(error);
    onWarning?.(`Failed to load theme-switcher config from '${path}': ${message}`);
    return null;
  }
}

export function resolveConfig(
  globalPath: string,
  projectPath: string | null,
  onWarning?: (message: string) => void,
): ThemeSwitcherConfig {
  return readConfig(projectPath, onWarning)
    ?? readConfig(globalPath, onWarning)
    ?? { nightStart: DEFAULT_NIGHT_START, nightEnd: DEFAULT_NIGHT_END };
}
