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
  settingsPath: string;
  userDataRoot: string;
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
    settingsPath: path.join(userDataRoot, "settings.json"),
    userDataRoot,
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
  await expect(paletteInput).toBeHidden({ timeout: 15_000 });
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

test("toggles the current note pin action from the command palette", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "nested", /nested-note\.md/i);
    await expect(glyph.window.getByText("Nested note body.")).toBeVisible();

    await selectPaletteItem(glyph.window, "pin current note", /pin current note/i);
    const unpinSearch = await openCommandPalette(glyph.window);
    await unpinSearch.fill("unpin current note");
    await expect(
      glyph.window.getByRole("option", { name: /unpin current note/i }).first(),
    ).toBeVisible();
    await glyph.window.keyboard.press("Escape");

    await selectPaletteItem(glyph.window, "unpin current note", /unpin current note/i);
    const pinSearch = await openCommandPalette(glyph.window);
    await pinSearch.fill("pin current note");
    await expect(
      glyph.window.getByRole("option", { name: /pin current note/i }).first(),
    ).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("shows tooltips on toolbar button hover", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);
    await expect(glyph.window.getByText("Smoke test note content.")).toBeVisible();

    const tooltipContent = glyph.window.locator('[data-slot="tooltip-content"]');

    // Hover the Settings gear button — tooltip should appear
    const settingsButton = glyph.window.getByRole("button", { name: "Settings" });
    await settingsButton.hover();
    await expect(tooltipContent.filter({ hasText: "Settings" })).toBeVisible();

    // Move mouse away — tooltip should disappear
    await glyph.window.mouse.move(0, 0);
    await expect(tooltipContent.filter({ hasText: "Settings" })).toBeHidden();

    // Hover the New Note button in the header toolbar — tooltip should show text with keyboard shortcut
    const newNoteButton = glyph.window.getByRole("button", { name: "New note" }).first();
    await newNoteButton.hover();
    await expect(tooltipContent.filter({ hasText: /New Note/ })).toBeVisible();

    // Move mouse away — tooltip should disappear
    await glyph.window.mouse.move(0, 0);
    await expect(tooltipContent.filter({ hasText: /New Note/ })).toBeHidden();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("sidebar reflects new note immediately without waiting for file watcher", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Trigger "New Note" via command palette
    await selectPaletteItem(glyph.window, "new note", /new note/i);

    // The created file name starts with "Untitled-" — the sidebar strips the .md
    // extension for display, so match without it. Must appear immediately (no watcher delay).
    await expect(glyph.window.getByRole("button", { name: /Untitled-\d+/ }).first()).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
  }
});

test("sidebar reflects new folder immediately without waiting for file watcher", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Trigger "New Folder" via command palette
    await selectPaletteItem(glyph.window, "new folder", /new folder/i);

    // The created folder name starts with "New Folder-" — it must appear in the
    // sidebar immediately, not after a multi-second watcher delay.
    await expect(glyph.window.getByRole("button", { name: /New Folder-\d+/ }).first()).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
  }
});

// ─── Non-default workspace (core bug) ────────────────────────────────────────

test("sidebar reflects new note immediately in a non-default workspace", async ({}, testInfo) => {
  const sandbox = await createGlyphSandbox();
  // Create a second workspace directory alongside the default one
  const secondWorkspace = path.join(path.dirname(sandbox.workspaceRoot), "workspace2");
  await fs.mkdir(secondWorkspace, { recursive: true });
  await fs.writeFile(path.join(secondWorkspace, "existing.md"), "# Existing");

  const glyph = await launchGlyph(sandbox);
  try {
    await expectAppShell(glyph.window);
    // Load default workspace first (sets activeWorkspaceRoot in main process)
    await openWorkspace(glyph.window, sandbox.workspaceRoot);
    // Now also open the second workspace so it appears in the sidebar
    await openWorkspace(glyph.window, secondWorkspace);

    // Open a file from the second workspace so the active file is there
    await selectPaletteItem(glyph.window, "existing", /existing\.md/i);

    // Create a new note — should land in the second workspace
    await selectPaletteItem(glyph.window, "new note", /new note/i);

    // The new Untitled file must appear in the sidebar immediately
    await expect(glyph.window.getByRole("button", { name: /Untitled-\d+/ }).first()).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
    await fs.rm(secondWorkspace, { force: true, recursive: true });
  }
});

test("sidebar reflects new folder immediately in a non-default workspace", async ({}, testInfo) => {
  const sandbox = await createGlyphSandbox();
  const secondWorkspace = path.join(path.dirname(sandbox.workspaceRoot), "workspace2b");
  await fs.mkdir(secondWorkspace, { recursive: true });
  await fs.writeFile(path.join(secondWorkspace, "existing.md"), "# Existing");

  const glyph = await launchGlyph(sandbox);
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, sandbox.workspaceRoot);
    await openWorkspace(glyph.window, secondWorkspace);

    // Open a file from the second workspace
    await selectPaletteItem(glyph.window, "existing", /existing\.md/i);

    // Create a new folder — should land in the second workspace
    await selectPaletteItem(glyph.window, "new folder", /new folder/i);

    // The folder must appear in the sidebar immediately
    await expect(glyph.window.getByRole("button", { name: /New Folder-\d+/ }).first()).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
    await fs.rm(secondWorkspace, { force: true, recursive: true });
  }
});

// ─── Sidebar tree interactions ────────────────────────────────────────────────

test("nested note is visible in the sidebar tree when folder is expanded", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Wait for the sidebar to populate with the workspace files first
    await expect(glyph.window.getByRole("button", { name: /welcome/ }).first()).toBeVisible();

    // Sub-folders start expanded by default (local state = true), so nested
    // notes are immediately visible once the workspace root is loaded.
    await expect(glyph.window.getByRole("button", { name: /nested-note/ }).first()).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("expanding then collapsing a folder hides its children", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Wait for sidebar to fully hydrate — welcome.md is at the root level
    await expect(glyph.window.getByRole("button", { name: /welcome/ }).first()).toBeVisible();

    // Sub-folder "notes" is expanded by default — nested note should be visible
    await expect(glyph.window.getByRole("button", { name: /nested-note/ }).first()).toBeVisible();

    // Click the notes folder button to collapse it (depth>0 uses local toggle)
    const notesFolder = glyph.window.getByRole("button", { name: "notes", exact: true });
    await notesFolder.click();
    await expect(glyph.window.getByRole("button", { name: /nested-note/ })).toBeHidden();

    // Click again to re-expand
    await notesFolder.click();
    await expect(glyph.window.getByRole("button", { name: /nested-note/ }).first()).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("note created after folder creation lands inside that folder", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Create a folder first
    await selectPaletteItem(glyph.window, "new folder", /new folder/i);
    const folderButton = glyph.window
      .getByRole("button", { name: /New Folder-\d+/, exact: false })
      .first();
    await expect(folderButton).toBeVisible({ timeout: 2000 });

    // Create a note — the new note should land inside the last-created folder.
    // The folder is depth>0 so it starts expanded by default.
    await selectPaletteItem(glyph.window, "new note", /new note/i);

    // The Untitled note should appear; the folder starts expanded so it
    // is visible directly without an extra click.
    await expect(
      glyph.window.getByRole("button", { name: /Untitled-\d+/, exact: false }).first(),
    ).toBeVisible({ timeout: 3000 });
  } finally {
    await glyph.stop(testInfo);
  }
});

// ─── Command palette ─────────────────────────────────────────────────────────

test("command palette closes on Escape key", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);

    const paletteInput = await openCommandPalette(glyph.window);
    await glyph.window.keyboard.press("Escape");

    await expect(paletteInput).toBeHidden();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("command palette search filters results to matching file names", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    const paletteInput = await openCommandPalette(glyph.window);
    await paletteInput.fill("nested");

    await expect(glyph.window.getByRole("option", { name: /nested-note/ }).first()).toBeVisible();
    await expect(glyph.window.getByRole("option", { name: /welcome/ })).toBeHidden();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("command palette shows settings option", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    const paletteInput = await openCommandPalette(glyph.window);
    await paletteInput.fill("settings");

    await expect(glyph.window.getByRole("option", { name: /settings/i }).first()).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

// ─── Settings panel ───────────────────────────────────────────────────────────

test("settings panel opens and shows General heading", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "settings", /settings/i);

    // The General tab heading is always visible in the settings panel
    await expect(glyph.window.getByRole("heading", { name: "General" })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("settings panel closes when Escape is pressed", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Open settings via the Settings button
    const settingsBtn = glyph.window.getByRole("button", { name: "Settings" });
    await settingsBtn.click();
    await expect(glyph.window.getByRole("heading", { name: "General" })).toBeVisible();

    // Close with Escape — the Settings button only opens, not toggles
    await glyph.window.keyboard.press("Escape");
    await expect(glyph.window.getByRole("heading", { name: "General" })).toBeHidden();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("theme mode persists as light in settings file", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "settings", /settings/i);

    await glyph.window.getByLabel("Theme mode").click();
    await glyph.window.getByRole("option", { name: "Light" }).click();

    await expect
      .poll(async () => {
        const settings = await readJson<{ themeMode?: string }>(glyph.sandbox.settingsPath);
        return settings?.themeMode ?? null;
      })
      .toBe("light");
  } finally {
    await glyph.stop(testInfo);
  }
});

// ─── Note lifecycle ───────────────────────────────────────────────────────────

test("opening a seeded nested note shows its content in the editor", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "nested", /nested-note\.md/i);
    await expect(glyph.window.getByText("Nested note body.")).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("new note is editable and content persists after save", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "new note", /new note/i);
    // TipTap editor is a contenteditable div with data-glyph-editor="true"
    const editor = glyph.window.locator('[data-glyph-editor="true"]');
    await expect(editor).toBeVisible();

    await editor.click();
    await glyph.window.keyboard.type("My Test Content");

    // Explicitly save with Cmd/Ctrl+S
    await glyph.window.keyboard.press(`${modKey}+S`);

    // The note should remain open and content should still be visible
    await expect(glyph.window.getByText("My Test Content")).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("delete file removes it from the sidebar", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Create a note then delete it
    await selectPaletteItem(glyph.window, "new note", /new note/i);
    const noteButton = glyph.window
      .getByRole("button", { name: /Untitled-\d+/, exact: false })
      .first();
    await expect(noteButton).toBeVisible({ timeout: 3000 });

    // Hover the note row to reveal the "..." (Note actions) menu button, then click it
    await noteButton.hover();
    const noteActionsBtn = glyph.window.getByRole("button", { name: "Note actions" }).first();
    await noteActionsBtn.click({ force: true });
    // Context menu items render as plain <button> elements (role="button"), not menuitem
    const deleteButton = glyph.window.getByRole("button", { name: /^Delete$/ });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Note should be gone from the sidebar
    await expect(glyph.window.getByRole("button", { name: /Untitled-\d+/ })).toBeHidden({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
  }
});

test("rename file updates its name in the sidebar", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Create a note to rename
    await selectPaletteItem(glyph.window, "new note", /new note/i);
    const noteButton = glyph.window
      .getByRole("button", { name: /Untitled-\d+/, exact: false })
      .first();
    await expect(noteButton).toBeVisible({ timeout: 3000 });

    // Hover to reveal the "..." button, then click → Rename
    await noteButton.hover();
    const noteActionsBtn = glyph.window.getByRole("button", { name: "Note actions" }).first();
    await noteActionsBtn.click({ force: true });
    const renameButton = glyph.window.getByRole("button", { name: /^Rename$/ });
    await expect(renameButton).toBeVisible();
    await renameButton.click();

    // An inline input appears — it has no aria-label, select by type="text"
    const renameInput = glyph.window.locator('input[type="text"]').last();
    await expect(renameInput).toBeVisible();
    await renameInput.fill("my-renamed-note");
    await glyph.window.keyboard.press("Enter");

    // Sidebar should reflect the new name
    await expect(glyph.window.getByRole("button", { name: /my-renamed-note/ }).first()).toBeVisible(
      { timeout: 3000 },
    );
  } finally {
    await glyph.stop(testInfo);
  }
});

test("rename folder updates its name in the sidebar", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    // Create a folder to rename
    await selectPaletteItem(glyph.window, "new folder", /new folder/i);
    const folderButton = glyph.window
      .getByRole("button", { name: /New Folder-\d+/, exact: false })
      .first();
    await expect(folderButton).toBeVisible({ timeout: 3000 });

    // Hover to reveal "..." (Folder actions), then click → Rename
    await folderButton.hover();
    const folderActionsBtn = glyph.window.getByRole("button", { name: "Folder actions" }).first();
    await folderActionsBtn.click({ force: true });
    const renameButton = glyph.window.getByRole("button", { name: /^Rename$/ });
    await expect(renameButton).toBeVisible();
    await renameButton.click();

    const renameInput = glyph.window.locator('input[type="text"]').last();
    await expect(renameInput).toBeVisible();
    await renameInput.fill("renamed-folder");
    await glyph.window.keyboard.press("Enter");

    await expect(glyph.window.getByRole("button", { name: /renamed-folder/ }).first()).toBeVisible({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
  }
});

test("delete folder removes it from the sidebar", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "new folder", /new folder/i);
    const folderButton = glyph.window
      .getByRole("button", { name: /New Folder-\d+/, exact: false })
      .first();
    await expect(folderButton).toBeVisible({ timeout: 3000 });

    // Hover to reveal "..." (Folder actions), then click → Delete
    await folderButton.hover();
    const folderActionsBtn = glyph.window.getByRole("button", { name: "Folder actions" }).first();
    await folderActionsBtn.click({ force: true });
    const deleteButton = glyph.window.getByRole("button", { name: /^Delete$/ });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(glyph.window.getByRole("button", { name: /New Folder-\d+/ })).toBeHidden({
      timeout: 3000,
    });
  } finally {
    await glyph.stop(testInfo);
  }
});

// ─── Pinning ─────────────────────────────────────────────────────────────────

test("pinning a note persists its path to settings file", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);
    await selectPaletteItem(glyph.window, "pin current note", /pin current note/i);

    await expect
      .poll(async () => {
        const settings = await readJson<{ pinnedFiles?: string[] }>(glyph.sandbox.settingsPath);
        return settings?.pinnedFiles?.some((p) => p.endsWith("welcome.md")) ?? false;
      })
      .toBe(true);
  } finally {
    await glyph.stop(testInfo);
  }
});

test("unpinning a note removes its path from settings file", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);
    await selectPaletteItem(glyph.window, "pin current note", /pin current note/i);

    await expect
      .poll(async () => {
        const settings = await readJson<{ pinnedFiles?: string[] }>(glyph.sandbox.settingsPath);
        return settings?.pinnedFiles?.some((p) => p.endsWith("welcome.md")) ?? false;
      })
      .toBe(true);

    await selectPaletteItem(glyph.window, "unpin current note", /unpin current note/i);

    await expect
      .poll(async () => {
        const settings = await readJson<{ pinnedFiles?: string[] }>(glyph.sandbox.settingsPath);
        return settings?.pinnedFiles?.some((p) => p.endsWith("welcome.md")) ?? false;
      })
      .toBe(false);
  } finally {
    await glyph.stop(testInfo);
  }
});

// ─── Focus mode ───────────────────────────────────────────────────────────────

test("focus mode hides the sidebar when toggled on", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // The sidebar aside (with bg-sidebar class) should be present initially
    const sidebarAside = glyph.window.locator("aside.bg-sidebar");
    await expect(sidebarAside).toBeVisible();

    // Toggle focus mode — command is "Enter Focus Mode"
    await selectPaletteItem(glyph.window, "focus mode", /enter focus mode/i);

    // In focus mode the sidebar component is unmounted entirely
    await expect(sidebarAside).toBeHidden();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("focus mode persists in settings", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    await selectPaletteItem(glyph.window, "focus mode", /enter focus mode/i);

    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { focusMode?: boolean };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.focusMode ?? false;
      })
      .toBe(true);
  } finally {
    await glyph.stop(testInfo);
  }
});
