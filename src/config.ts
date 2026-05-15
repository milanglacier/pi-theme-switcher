import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { ResolvedThemeSwitcherConfig, ThemeSwitcherConfig } from "./types.js";

export const DEFAULT_NIGHT_START = 23;
export const DEFAULT_NIGHT_END = 7;

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === code;
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

function parseConfig(raw: string, filePath: string): ThemeSwitcherConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse theme-switcher config at '${filePath}': ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid theme-switcher config at '${filePath}': expected a JSON object`);
  }

  const record = parsed as Record<string, unknown>;
  // Only set fields that were explicitly provided; nullish means "not configured"
  const nightStart = isValidHour(record.nightStart) ? (record.nightStart as number) : undefined;
  const nightEnd = isValidHour(record.nightEnd) ? (record.nightEnd as number) : undefined;

  return { nightStart, nightEnd };
}

function loadConfig(
  path: string | null,
  onWarning?: (message: string) => void,
): ThemeSwitcherConfig | null {
  if (!path) {
    return null;
  }

  try {
    return parseConfig(readFileSync(path, "utf-8"), path);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }

    const message = error instanceof Error ? error.message : String(error);
    onWarning?.(`Failed to load theme-switcher config from '${path}': ${message}`);
    return null;
  }
}

export interface ResolvedConfig extends ResolvedThemeSwitcherConfig {
  stamp: string;
}

function getFileStamp(path: string): string {
  try {
    return String(statSync(path).mtimeMs);
  } catch {
    return "missing";
  }
}

function buildStamp(globalPath: string, projectPath: string | null): string {
  return `${globalPath}:${getFileStamp(globalPath)}|${projectPath ?? "none"}:${projectPath ? getFileStamp(projectPath) : "none"}`;
}

export function resolveConfig(
  globalPath: string,
  projectPath: string | null,
  onWarning?: (message: string) => void,
): ResolvedConfig {
  const globalConfig = loadConfig(globalPath, onWarning);
  const projectConfig = loadConfig(projectPath, onWarning);

  // Project config takes precedence over global for each field independently.
  // Fields not set in either config fall back to defaults.
  const nightStart = projectConfig?.nightStart ?? globalConfig?.nightStart ?? DEFAULT_NIGHT_START;
  const nightEnd = projectConfig?.nightEnd ?? globalConfig?.nightEnd ?? DEFAULT_NIGHT_END;
  const stamp = buildStamp(globalPath, projectPath);

  return { nightStart, nightEnd, stamp };
}
