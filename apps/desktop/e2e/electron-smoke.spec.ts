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

type GlyphHarness = {
  app: ElectronApplication;
  stop: (testInfo: TestInfo) => Promise<void>;
  window: Page;
  workspaceRoot: string;
};

async function launchGlyph(): Promise<GlyphHarness> {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-e2e-"));
  const workspaceRoot = path.join(sandboxRoot, "workspace");
  const userDataRoot = path.join(sandboxRoot, "user-data");

  await fs.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  await fs.mkdir(userDataRoot, { recursive: true });

  await fs.writeFile(
    path.join(workspaceRoot, "welcome.md"),
    ["# Welcome to Glyph", "", "Smoke test note content."].join("\n"),
  );
  await fs.writeFile(
    path.join(workspaceRoot, "notes", "nested-note.md"),
    ["# Nested Note", "", "Nested note body."].join("\n"),
  );

  const app = await electron.launch({
    executablePath: electronBinary,
    args: [desktopRoot],
    cwd: desktopRoot,
    env: {
      ...process.env,
      GLYPH_E2E_DIST: "1",
      GLYPH_E2E_USER_DATA: userDataRoot,
      GLYPH_E2E_WORKSPACE: workspaceRoot,
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

      if (!keepSandbox) {
        await fs.rm(sandboxRoot, { force: true, recursive: true });
      }
    }
  };

  return {
    app,
    stop,
    window,
    workspaceRoot,
  };
}

async function expectAppShell(window: Page) {
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator('[aria-label="Glyph"]')).toBeVisible();
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

// eslint-disable-next-line no-empty-pattern
test("launches Glyph and opens settings from the command palette", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.workspaceRoot);

    await glyph.window.keyboard.press(`${modKey}+P`);

    const paletteInput = glyph.window.getByLabel("Search notes, skills, and commands…");
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill("settings");
    await glyph.window.getByRole("option", { name: /settings/i }).click();

    await expect(glyph.window.getByText("Glyph Desktop")).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

// eslint-disable-next-line no-empty-pattern
test("opens a seeded markdown note from the workspace", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.workspaceRoot);

    await glyph.window.keyboard.press(`${modKey}+P`);
    const paletteInput = glyph.window.getByLabel("Search notes, skills, and commands…");
    await expect(paletteInput).toBeVisible();
    await paletteInput.fill("welcome");
    await expect(glyph.window.getByRole("option", { name: /welcome\.md/i })).toBeVisible();
    await glyph.window.keyboard.press("Enter");

    await expect(glyph.window.getByText("Smoke test note content.")).toBeVisible();
    await expect(glyph.window.getByRole("heading", { name: "Welcome to Glyph" })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});
