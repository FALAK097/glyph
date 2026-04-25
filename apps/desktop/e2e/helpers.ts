import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import type { ElectronApplication, Page, TestInfo } from "@playwright/test";
import { _electron as electron } from "playwright";

import type { GlyphHarness, GlyphSandbox } from "./types";

const require = createRequire(import.meta.url);
const electronBinary = require("electron") as string;
const desktopRoot = path.resolve(import.meta.dirname, "..");
const isMac = process.platform === "darwin";
const keepSandbox = process.env.GLYPH_E2E_KEEP_SANDBOX === "1";
const modKey = isMac ? "Meta" : "Control";

export { modKey, isMac };

export async function createGlyphSandbox(): Promise<GlyphSandbox> {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-e2e-"));
  const workspaceRoot = path.join(sandboxRoot, "workspace");
  const userDataRoot = path.join(sandboxRoot, "user-data");
  const welcomeNotePath = path.join(workspaceRoot, "welcome.md");
  const findSamplePath = path.join(workspaceRoot, "find-sample.md");
  const nestedNotePath = path.join(workspaceRoot, "notes", "nested-note.md");
  const ignoredTextFilePath = path.join(workspaceRoot, "ignore-me.txt");

  await fs.mkdir(path.join(workspaceRoot, "notes"), { recursive: true });
  await fs.mkdir(userDataRoot, { recursive: true });

  await fs.writeFile(
    welcomeNotePath,
    [
      "# Welcome to Glyph",
      "",
      "Smoke test note content.",
      "",
      "Preview the [Nested Note](notes/nested-note.md).",
    ].join("\n"),
  );
  await fs.writeFile(
    findSamplePath,
    [
      "# Find Sample",
      "",
      "Needle line one.",
      "Needle line two.",
      "Another needle appears here.",
    ].join("\n"),
  );
  await fs.writeFile(nestedNotePath, ["# Nested Note", "", "Nested note body."].join("\n"));
  await fs.writeFile(ignoredTextFilePath, "This file should not be indexed as markdown.");

  return {
    cleanup: async () => {
      if (!keepSandbox) {
        await fs.rm(sandboxRoot, { force: true, recursive: true });
      }
    },
    settingsPath: path.join(userDataRoot, "settings.json"),
    userDataRoot,
    workspaceRoot,
  };
}

export async function launchGlyph(existingSandbox?: GlyphSandbox): Promise<GlyphHarness> {
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
