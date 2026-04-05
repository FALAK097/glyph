/* eslint-disable no-empty-pattern */

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import type { ElectronApplication, Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

const require = createRequire(import.meta.url);
const electronBinary = require("electron") as string;
const desktopRoot = path.resolve(import.meta.dirname, "..");
const isMac = process.platform === "darwin";
const keepSandbox = process.env.GLYPH_E2E_KEEP_SANDBOX === "1";
const modKey = isMac ? "Meta" : "Control";

type GlyphSandbox = {
  cleanup: () => Promise<void>;
  nestedNotePath: string;
  sandboxRoot: string;
  settingsPath: string;
  userDataRoot: string;
  welcomeNotePath: string;
  workspaceRoot: string;
};

type GlyphHarness = {
  app: ElectronApplication;
  sandbox: GlyphSandbox;
  stop: (testInfo: TestInfo) => Promise<void>;
  window: Page;
};

async function createGlyphSandbox(): Promise<GlyphSandbox> {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-e2e-"));
  const workspaceRoot = path.join(sandboxRoot, "workspace");
  const userDataRoot = path.join(sandboxRoot, "user-data");
  const welcomeNotePath = path.join(workspaceRoot, "welcome.md");
  const nestedNotePath = path.join(workspaceRoot, "notes", "nested-note.md");

  await fs.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  await fs.mkdir(userDataRoot, { recursive: true });

  await fs.writeFile(
    welcomeNotePath,
    ["# Welcome to Glyph", "", "Smoke test note content."].join("\n"),
  );
  await fs.writeFile(nestedNotePath, ["# Nested Note", "", "Nested note body."].join("\n"));

  return {
    cleanup: async () => {
      if (!keepSandbox) {
        await fs.rm(sandboxRoot, { force: true, recursive: true });
      }
    },
    nestedNotePath,
    sandboxRoot,
    settingsPath: path.join(userDataRoot, "settings.json"),
    userDataRoot,
    welcomeNotePath,
    workspaceRoot,
  };
}

async function launchGlyph(existingSandbox?: GlyphSandbox): Promise<GlyphHarness> {
  const sandbox = existingSandbox ?? (await createGlyphSandbox());
  const ownsSandbox = !existingSandbox;

  const app = await electron.launch({
    executablePath: electronBinary,
    args: [desktopRoot],
    cwd: desktopRoot,
    env: {
      ...process.env,
      GLYPH_E2E_DIST: "1",
      GLYPH_E2E_USER_DATA: sandbox.userDataRoot,
      GLYPH_E2E_WORKSPACE: sandbox.workspaceRoot,
    },
    timeout: 60_000,
  });

  const window = await app.firstWindow();
  const consoleMessages: string[] = [];

  window.on("console", (message) => {
    const type = message.type();
    if (type === "error" || type === "warning") {
      consoleMessages.push(`[${type}] ${message.text()}`);
    }
  });

  window.on("pageerror", (error) => {
    consoleMessages.push(`[pageerror] ${error.message}`);
  });

  await window.context().tracing.start({
    screenshots: true,
    snapshots: true,
  });

  const stop = async (testInfo: TestInfo) => {
    try {
      if (testInfo.status !== testInfo.expectedStatus) {
        await window.screenshot({
          animations: "disabled",
          path: testInfo.outputPath("failure.png"),
        });
        await window.context().tracing.stop({
          path: testInfo.outputPath("trace.zip"),
        });

        if (consoleMessages.length > 0) {
          await fs.writeFile(
            testInfo.outputPath("renderer-console.txt"),
            consoleMessages.join("\n"),
          );
        }
      } else {
        await window.context().tracing.stop();
      }
    } finally {
      await app.close();

      if (ownsSandbox) {
        await sandbox.cleanup();
      }
    }
  };

  return {
    app,
    sandbox,
    stop,
    window,
  };
}

async function expectAppShell(window: Page) {
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator('[aria-label="Glyph"]')).toBeVisible();
}

async function openCommandPalette(window: Page) {
  await window.keyboard.press(`${modKey}+P`);

  const paletteInput = window.getByLabel("Search notes, skills, and commands…");
  await expect(paletteInput).toBeVisible();
  return paletteInput;
}

async function selectPaletteItem(window: Page, query: string, name: RegExp) {
  const paletteInput = await openCommandPalette(window);
  await paletteInput.fill(query);
  const option = window.getByRole("option", { name }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function openWorkspace(window: Page, workspaceRoot: string) {
  const workspace = await window.evaluate(async (targetWorkspaceRoot) => {
    const glyph = (
      window as Window & {
        glyph: {
          openFolder: (dirPath?: string) => Promise<{
            activeFile: { name: string } | null;
            rootPath: string;
          } | null>;
        };
      }
    ).glyph;

    return await glyph.openFolder(targetWorkspaceRoot);
  }, workspaceRoot);

  expect(workspace).not.toBeNull();
  expect(workspace?.rootPath).toBe(workspaceRoot);
}

async function readJson<T>(targetPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

test("launches Glyph and opens settings from the command palette", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "settings", /settings/i);

    await expect(glyph.window.getByText("Glyph Desktop")).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("opens a seeded markdown note from the workspace", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    await expect(glyph.window.getByText("Smoke test note content.")).toBeVisible();
    await expect(glyph.window.getByRole("heading", { name: "Welcome to Glyph" })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("creates a note, derives its filename from the heading, and saves it to disk", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "new note", /new note/i);

    const editor = glyph.window.locator('[data-glyph-editor="true"]');
    await expect(editor).toBeVisible();
    await editor.click();
    await glyph.window.keyboard.type("# Release Smoke\n\nCreated by Playwright.");

    await expect(glyph.window.getByText("Unsaved")).toBeVisible();

    const renamedPath = path.join(glyph.sandbox.workspaceRoot, "Release Smoke.md");

    await expect
      .poll(async () => {
        try {
          return await fs.readFile(renamedPath, "utf8");
        } catch {
          return null;
        }
      })
      .toContain("Created by Playwright.");

    await expect(glyph.window.getByRole("heading", { name: "Release Smoke" })).toBeVisible();
    await expect(glyph.window.getByText(/Saved \d{1,2}:\d{2}/)).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("persists theme mode changes from settings", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "settings", /settings/i);
    await glyph.window.getByLabel("Theme mode").click();
    await glyph.window.getByRole("option", { name: "Dark" }).click();

    await expect
      .poll(async () =>
        glyph.window.evaluate(() => document.documentElement.classList.contains("dark")),
      )
      .toBe(true);

    await expect
      .poll(async () => {
        const settings = await readJson<{ themeMode?: string }>(glyph.sandbox.settingsPath);
        return settings?.themeMode ?? null;
      })
      .toBe("dark");
  } finally {
    await glyph.stop(testInfo);
  }
});

test("restores the last opened note after relaunch", async ({}, testInfo) => {
  const sandbox = await createGlyphSandbox();
  let firstLaunch: GlyphHarness | null = null;
  let secondLaunch: GlyphHarness | null = null;

  try {
    firstLaunch = await launchGlyph(sandbox);
    await expectAppShell(firstLaunch.window);
    await openWorkspace(firstLaunch.window, sandbox.workspaceRoot);
    await selectPaletteItem(firstLaunch.window, "nested", /nested-note\.md/i);

    await expect(firstLaunch.window.getByText("Nested note body.")).toBeVisible();

    await expect
      .poll(async () => {
        const sessionJson = await firstLaunch?.window.evaluate(() =>
          window.localStorage.getItem("glyph.editor-session"),
        );
        return sessionJson
          ? (JSON.parse(sessionJson) as { state?: { noteFilePath?: string } })
          : null;
      })
      .toMatchObject({
        state: {
          noteFilePath: sandbox.nestedNotePath,
        },
      });

    await firstLaunch.stop(testInfo);
    firstLaunch = null;

    secondLaunch = await launchGlyph(sandbox);
    await expectAppShell(secondLaunch.window);
    await expect(secondLaunch.window.getByRole("heading", { name: "Nested Note" })).toBeVisible();
    await expect(secondLaunch.window.getByText("Nested note body.")).toBeVisible();
  } finally {
    if (firstLaunch) {
      await firstLaunch.stop(testInfo);
    }

    if (secondLaunch) {
      await secondLaunch.stop(testInfo);
    }

    await sandbox.cleanup();
  }
});
