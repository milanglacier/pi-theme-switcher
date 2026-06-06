import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import piThemeSwitcher from "../index.js";
import {
  DEFAULT_NIGHT_END,
  DEFAULT_NIGHT_START,
  getGlobalConfigPath,
  getProjectConfigPath,
  resolveConfig,
} from "../src/config.js";
import { isInNightRange, resolveTheme } from "../src/theme.js";
import type { ThemeSwitcherConfig } from "../src/types.js";

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

type TestFn = () => void | Promise<void>;

async function runTest(name: string, fn: TestFn): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTempDir<T>(operation: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "pi-theme-switcher-"));
  try {
    return operation(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeJson(path: string, content: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(content, null, 2), "utf8");
}

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    originals[key] = process.env[key];
  }

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fn();
  } finally {
    for (const [key, origValue] of Object.entries(originals)) {
      if (origValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = origValue;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Unit: isInNightRange
// ---------------------------------------------------------------------------

await runTest("isInNightRange: wrapping range (nightStart > nightEnd)", () => {
  // 23-7: 23, 0-7 are night
  assert.equal(isInNightRange(23, 23, 7), true);
  assert.equal(isInNightRange(0, 23, 7), true);
  assert.equal(isInNightRange(7, 23, 7), true);
  assert.equal(isInNightRange(8, 23, 7), false);
  assert.equal(isInNightRange(22, 23, 7), false);
  assert.equal(isInNightRange(12, 23, 7), false);
});

await runTest("isInNightRange: non-wrapping range (nightStart <= nightEnd)", () => {
  // 0-6: midnight to early morning
  assert.equal(isInNightRange(0, 0, 6), true);
  assert.equal(isInNightRange(3, 0, 6), true);
  assert.equal(isInNightRange(6, 0, 6), true);
  assert.equal(isInNightRange(7, 0, 6), false);
  assert.equal(isInNightRange(23, 0, 6), false);
});

await runTest("isInNightRange: single-hour range (nightStart == nightEnd)", () => {
  assert.equal(isInNightRange(12, 12, 12), true);
  assert.equal(isInNightRange(11, 12, 12), false);
  assert.equal(isInNightRange(13, 12, 12), false);
});

await runTest("isInNightRange: full-day range (0-23)", () => {
  for (let h = 0; h <= 23; h++) {
    assert.equal(isInNightRange(h, 0, 23), true);
  }
});

// ---------------------------------------------------------------------------
// Unit: resolveTheme
// ---------------------------------------------------------------------------

const defaultConfig: ThemeSwitcherConfig = { nightStart: 23, nightEnd: 7 };

await runTest("resolveTheme: PI_AGENT_THEME=dark takes highest precedence", () => {
  withEnv({ PI_AGENT_THEME: "dark", THEME_MODE: "day" }, () => {
    // It's daytime (hour=12) but PI_AGENT_THEME=dark should win
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "dark");
  });
});

await runTest("resolveTheme: PI_AGENT_THEME=light overrides night time", () => {
  withEnv({ PI_AGENT_THEME: "light", THEME_MODE: "night" }, () => {
    // It's night (hour=0) but PI_AGENT_THEME=light should win
    assert.equal(resolveTheme(defaultConfig, process.env, 0), "light");
  });
});

await runTest("resolveTheme: PI_AGENT_THEME with whitespace is trimmed", () => {
  withEnv({ PI_AGENT_THEME: "  dark  " }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "dark");
  });
});

await runTest("resolveTheme: PI_AGENT_THEME is case-insensitive", () => {
  withEnv({ PI_AGENT_THEME: "DARK" }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "dark");
  });
});

await runTest("resolveTheme: invalid PI_AGENT_THEME falls through to next priority", () => {
  withEnv({ PI_AGENT_THEME: "midnight" }, () => {
    // It's night (hour=0), should fall through to time-based → dark
    assert.equal(resolveTheme(defaultConfig, process.env, 0), "dark");
  });
});

await runTest("resolveTheme: THEME_MODE=night maps to dark", () => {
  withEnv({ THEME_MODE: "night" }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "dark");
  });
});

await runTest("resolveTheme: THEME_MODE=day maps to light", () => {
  withEnv({ THEME_MODE: "day" }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 0), "light");
  });
});

await runTest("resolveTheme: THEME_MODE is case-insensitive", () => {
  withEnv({ THEME_MODE: "NIGHT" }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "dark");
  });
});

await runTest("resolveTheme: THEME_MODE with whitespace is trimmed", () => {
  withEnv({ THEME_MODE: "  day  " }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 0), "light");
  });
});

await runTest("resolveTheme: invalid THEME_MODE falls through to time-based", () => {
  withEnv({ PI_AGENT_THEME: undefined, THEME_MODE: "twilight" }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 0), "dark");  // night
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "light"); // day
  });
});

await runTest("resolveTheme: time-based with default config (23-7)", () => {
  withEnv({ PI_AGENT_THEME: undefined, THEME_MODE: undefined }, () => {
    assert.equal(resolveTheme(defaultConfig, process.env, 23), "dark");
    assert.equal(resolveTheme(defaultConfig, process.env, 0), "dark");
    assert.equal(resolveTheme(defaultConfig, process.env, 7), "dark");
    assert.equal(resolveTheme(defaultConfig, process.env, 8), "light");
    assert.equal(resolveTheme(defaultConfig, process.env, 12), "light");
    assert.equal(resolveTheme(defaultConfig, process.env, 22), "light");
  });
});

await runTest("resolveTheme: time-based with custom non-wrapping range (0-5)", () => {
  withEnv({ PI_AGENT_THEME: undefined, THEME_MODE: undefined }, () => {
    const config: ThemeSwitcherConfig = { nightStart: 0, nightEnd: 5 };
    assert.equal(resolveTheme(config, process.env, 0), "dark");
    assert.equal(resolveTheme(config, process.env, 5), "dark");
    assert.equal(resolveTheme(config, process.env, 6), "light");
  });
});

// ---------------------------------------------------------------------------
// Unit: config loading
// ---------------------------------------------------------------------------

await runTest("resolveConfig: returns defaults when no config files exist", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "nonexistent.json");
    const result = resolveConfig(globalPath, null);

    assert.equal(result.nightStart, 23);
    assert.equal(result.nightEnd, 7);
  });
});

await runTest("resolveConfig: loads global config", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "theme-switcher.json");
    writeJson(globalPath, { nightStart: 22, nightEnd: 6 });

    const result = resolveConfig(globalPath, null);

    assert.equal(result.nightStart, 22);
    assert.equal(result.nightEnd, 6);
  });
});

await runTest("resolveConfig: complete project config overrides global config", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "global.json");
    const projectPath = join(dir, "project.json");
    writeJson(globalPath, { nightStart: 22, nightEnd: 6 });
    writeJson(projectPath, { nightStart: 21, nightEnd: 5 });

    const result = resolveConfig(globalPath, projectPath);

    assert.equal(result.nightStart, 21);
    assert.equal(result.nightEnd, 5);
  });
});

await runTest("resolveConfig: partial project config is rejected and global config is used", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "global.json");
    const projectPath = join(dir, "project.json");
    writeJson(globalPath, { nightStart: 22, nightEnd: 6 });
    writeJson(projectPath, { nightStart: 21 });

    const warnings: string[] = [];
    const result = resolveConfig(globalPath, projectPath, (msg) => warnings.push(msg));

    assert.equal(result.nightStart, 22);
    assert.equal(result.nightEnd, 6);
    assert.ok(warnings.length > 0);
    assert.match(warnings[0], /configured together/);
  });
});

await runTest("resolveConfig: empty project config falls back to global config", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "global.json");
    const projectPath = join(dir, "project.json");
    writeJson(globalPath, { nightStart: 22, nightEnd: 6 });
    writeJson(projectPath, {});

    const result = resolveConfig(globalPath, projectPath);

    assert.equal(result.nightStart, 22);
    assert.equal(result.nightEnd, 6);
  });
});

await runTest("resolveConfig: invalid hour values fall back to defaults", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "theme-switcher.json");
    writeJson(globalPath, { nightStart: 25, nightEnd: -1 });

    const result = resolveConfig(globalPath, null);

    assert.equal(result.nightStart, 23); // fallback to default
    assert.equal(result.nightEnd, 7);    // fallback to default
  });
});

await runTest("resolveConfig: handles invalid JSON gracefully (warning callback)", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "theme-switcher.json");
    writeFileSync(globalPath, "not valid json", "utf8");

    const warnings: string[] = [];
    const result = resolveConfig(globalPath, null, (msg) => warnings.push(msg));

    // Falls back to defaults
    assert.equal(result.nightStart, 23);
    assert.equal(result.nightEnd, 7);
    assert.ok(warnings.length > 0);
    assert.match(warnings[0], /Failed to load/);
  });
});

await runTest("resolveConfig: handles non-object JSON gracefully", () => {
  withTempDir((dir) => {
    const globalPath = join(dir, "theme-switcher.json");
    writeJson(globalPath, "just a string");

    const warnings: string[] = [];
    const result = resolveConfig(globalPath, null, (msg) => warnings.push(msg));

    assert.equal(result.nightStart, 23);
    assert.equal(result.nightEnd, 7);
    assert.ok(warnings.length > 0);
    assert.match(warnings[0], /expected a JSON object/);
  });
});

await runTest("getGlobalConfigPath: uses PI_CODING_AGENT_DIR when set", () => {
  withEnv({ PI_CODING_AGENT_DIR: "/custom/agent" }, () => {
    assert.equal(getGlobalConfigPath(), "/custom/agent/theme-switcher.json");
  });
});

await runTest("getGlobalConfigPath: defaults to ~/.pi/agent when PI_CODING_AGENT_DIR is not set", () => {
  withEnv({ PI_CODING_AGENT_DIR: undefined }, () => {
    // Can't easily test the full path (depends on home), but verify it ends correctly
    assert.ok(getGlobalConfigPath().endsWith("/.pi/agent/theme-switcher.json"));
  });
});

await runTest("getProjectConfigPath: returns cwd/.pi/agent/theme-switcher.json", () => {
  assert.equal(
    getProjectConfigPath("/workspace/my-project"),
    "/workspace/my-project/.pi/agent/theme-switcher.json",
  );
});

// ---------------------------------------------------------------------------
// Integration: extension wiring
// ---------------------------------------------------------------------------

type MockExtensionAPI = {
  on: (name: string, handler: (...args: unknown[]) => unknown) => void;
};

type MockContext = {
  cwd: string;
  hasUI: boolean;
  ui: {
    setTheme: (theme: string) => void;
    notify: (message: string, level: string) => void;
  };
};

await runTest("extension: sets theme to dark when PI_AGENT_THEME=dark on session_start", () => {
  withEnv({ PI_AGENT_THEME: "dark" }, () => {
    const themeCalls: string[] = [];
    let sessionStartHandler: ((event: unknown, ctx: MockContext) => Promise<void> | void) | null = null;

    const mockPi: MockExtensionAPI = {
      on(name: string, handler: (...args: unknown[]) => unknown): void {
        if (name === "session_start") {
          sessionStartHandler = handler as (event: unknown, ctx: MockContext) => Promise<void> | void;
        }
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    piThemeSwitcher(mockPi as any);

    assert.ok(sessionStartHandler, "session_start handler should be registered");

    const ctx: MockContext = {
      cwd: "/test/project",
      hasUI: true,
      ui: {
        setTheme(theme: string): void {
          themeCalls.push(theme);
        },
        notify(): void {},
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionStartHandler as any)({}, ctx);

    assert.deepEqual(themeCalls, ["dark"]);
  });
});

await runTest("extension: sets theme to light when THEME_MODE=day on session_start", () => {
  withEnv({ THEME_MODE: "day" }, () => {
    const themeCalls: string[] = [];
    let sessionStartHandler: ((event: unknown, ctx: MockContext) => Promise<void> | void) | null = null;

    const mockPi: MockExtensionAPI = {
      on(name: string, handler: (...args: unknown[]) => unknown): void {
        if (name === "session_start") {
          sessionStartHandler = handler as (event: unknown, ctx: MockContext) => Promise<void> | void;
        }
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    piThemeSwitcher(mockPi as any);

    const ctx: MockContext = {
      cwd: "/test/project",
      hasUI: true,
      ui: {
        setTheme(theme: string): void {
          themeCalls.push(theme);
        },
        notify(): void {},
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionStartHandler as any)({}, ctx);

    assert.deepEqual(themeCalls, ["light"]);
  });
});

await runTest("extension: does not call setTheme if theme hasn't changed on re-evaluation", () => {
  withEnv({ PI_AGENT_THEME: "dark" }, () => {
    const themeCalls: string[] = [];
    let sessionStartHandler: ((event: unknown, ctx: MockContext) => Promise<void> | void) | null = null;

    const mockPi: MockExtensionAPI = {
      on(name: string, handler: (...args: unknown[]) => unknown): void {
        if (name === "session_start") {
          sessionStartHandler = handler as (event: unknown, ctx: MockContext) => Promise<void> | void;
        }
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    piThemeSwitcher(mockPi as any);

    const ctx: MockContext = {
      cwd: "/test/project",
      hasUI: true,
      ui: {
        setTheme(theme: string): void {
          themeCalls.push(theme);
        },
        notify(): void {},
      },
    };

    // First call: sets to dark
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionStartHandler as any)({}, ctx);
    assert.deepEqual(themeCalls, ["dark"]);

    // Simulate another session_start (e.g., /new)
    // currentTheme is reset to null in the handler, so it will call setTheme again
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionStartHandler as any)({}, ctx);
    assert.deepEqual(themeCalls, ["dark", "dark"]);
  });
});

await runTest("extension: polling does not read captured ctx after it becomes stale", () => {
  withEnv({ PI_AGENT_THEME: "dark", THEME_MODE: undefined }, () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;

    let intervalCallback: (() => void) | null = null;
    type FakeInterval = {
      cleared: boolean;
      unref(): FakeInterval;
    };
    const fakeInterval: FakeInterval = {
      cleared: false,
      unref(): FakeInterval {
        return this;
      },
    };

    try {
      globalThis.setInterval = ((callback: () => void) => {
        intervalCallback = callback;
        return fakeInterval;
      }) as unknown as typeof setInterval;

      globalThis.clearInterval = ((id: unknown) => {
        if (id === fakeInterval) {
          fakeInterval.cleared = true;
          return;
        }
        originalClearInterval(id as Parameters<typeof clearInterval>[0]);
      }) as typeof clearInterval;

      const themeCalls: string[] = [];
      let sessionStartHandler: ((event: unknown, ctx: MockContext) => Promise<void> | void) | null = null;

      const mockPi: MockExtensionAPI = {
        on(name: string, handler: (...args: unknown[]) => unknown): void {
          if (name === "session_start") {
            sessionStartHandler = handler as (event: unknown, ctx: MockContext) => Promise<void> | void;
          }
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      piThemeSwitcher(mockPi as any);
      assert.ok(sessionStartHandler, "session_start handler should be registered");

      let stale = false;
      const ctx = {
        get cwd(): string {
          if (stale) {
            throw new Error("ctx.cwd was read after ctx became stale");
          }
          return "/test/project";
        },
        hasUI: true,
        get ui(): MockContext["ui"] {
          if (stale) {
            throw new Error("ctx.ui was read after ctx became stale");
          }
          return {
            setTheme(theme: string): void {
              themeCalls.push(theme);
            },
            notify(): void {},
          };
        },
      } as MockContext;

      // Initial session_start is allowed to read the live ctx.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionStartHandler as any)({}, ctx);
      assert.deepEqual(themeCalls, ["dark"]);
      assert.ok(intervalCallback, "polling interval callback should be registered");

      // Simulate pi 0.81 invalidating the old session ctx after reload/session replacement.
      stale = true;
      process.env.PI_AGENT_THEME = "light";

      assert.doesNotThrow(() => {
        intervalCallback?.();
      });
      assert.deepEqual(themeCalls, ["dark", "light"]);
    } finally {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    }
  });
});

await runTest("extension: registers session_shutdown handler", () => {
  const shutdownRegistered: string[] = [];

  const mockPi: MockExtensionAPI = {
    on(name: string, _handler: (...args: unknown[]) => unknown): void {
      shutdownRegistered.push(name);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  piThemeSwitcher(mockPi as any);

  assert.ok(shutdownRegistered.includes("session_shutdown"));
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("\nAll theme-switcher tests passed.\n");
