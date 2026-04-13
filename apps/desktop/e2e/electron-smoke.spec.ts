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

type PersistedSessionState = {
  noteFilePath: string | null;
  noteTabPaths: string[];
  noteWorkspacePath: string | null;
};

async function createGlyphSandbox(): Promise<GlyphSandbox> {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "glyph-e2e-"));
  const workspaceRoot = path.join(sandboxRoot, "workspace");
  const userDataRoot = path.join(sandboxRoot, "user-data");
  const welcomeNotePath = path.join(workspaceRoot, "welcome.md");
  const findSamplePath = path.join(workspaceRoot, "find-sample.md");
  const nestedNotePath = path.join(workspaceRoot, "notes", "nested-note.md");

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
  const option = window.locator('[role="option"]').filter({ hasText: name }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
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

async function triggerTabSwitchShortcut(window: Page, tabNumber: number) {
  await window.keyboard.press(`${modKey}+${tabNumber}`);
}

async function triggerNextTabShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Meta+Shift+]" : "Control+Tab");
}

async function triggerPreviousTabShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Meta+Shift+[" : "Control+Shift+Tab");
}

async function triggerCloseOtherTabsShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Meta+Shift+W" : "Control+Shift+W");
}

async function getTabState(window: Page, options?: { workspaceRoot?: string }) {
  return await window.evaluate(
    ({ workspaceRoot }) => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
        .map((tab) => ({
          label: tab.textContent?.trim() ?? null,
          selected: tab.getAttribute("aria-selected"),
          title: tab.getAttribute("title"),
        }))
        .filter((tab) => !workspaceRoot || tab.title?.startsWith(workspaceRoot));
      const editor = document.querySelector('[data-glyph-editor="true"]');

      return {
        tabs,
        editorText: editor?.textContent ?? null,
      };
    },
    { workspaceRoot: options?.workspaceRoot ?? null },
  );
}

async function dragTabBefore(window: Page, sourceIndex: number, targetIndex: number) {
  const sourceTab = window.getByRole("tab").nth(sourceIndex);
  const targetTab = window.getByRole("tab").nth(targetIndex);

  await expect(sourceTab).toBeVisible();
  await expect(targetTab).toBeVisible();
  await sourceTab.dragTo(targetTab, {
    targetPosition: {
      x: 8,
      y: 12,
    },
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTabFileName(title: string | null) {
  return title ? path.basename(title) : null;
}

async function expectTabSelectedByTitle(window: Page, title: string | null) {
  await expect
    .poll(async () => {
      const tabState = await getTabState(window);
      return tabState.tabs.find((tab) => tab.title === title)?.selected ?? null;
    })
    .toBe("true");
}

function getExpectedBodyForTabTitle(title: string | null) {
  if (title?.endsWith("welcome.md")) {
    return "Smoke test note content.";
  }

  if (title?.endsWith("nested-note.md")) {
    return "Nested note body.";
  }

  const generatedTabMatch = title?.match(/tab-(\d+)\.md$/i);
  if (generatedTabMatch) {
    return `Body ${generatedTabMatch[1]}.`;
  }

  throw new Error(`Unexpected tab title: ${title ?? "null"}`);
}

async function readJson<T>(targetPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readPersistedSession(window: Page): Promise<PersistedSessionState | null> {
  return await window.evaluate(() => {
    const rawSession = window.localStorage.getItem("glyph.editor-session");
    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as {
      state?: PersistedSessionState;
    };

    return parsedSession.state ?? null;
  });
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
    await selectPaletteItem(glyph.window, "welcome", /welcome/i);

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
    await selectPaletteItem(glyph.window, "nested", /nested-note/i);
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

// ─── Sidebar tree interactions ────────────────────────────────────────────────

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

test("find in note highlights matches and cycles through them from the keyboard", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "find sample", /find-sample\.md/i);
    await expect(glyph.window.getByText("Needle line one.")).toBeVisible();

    await glyph.window.keyboard.press(`${modKey}+F`);
    const findInput = glyph.window.getByLabel("Find in current note");
    const findResults = glyph.window.getByLabel("Find results");

    await expect(findInput).toBeVisible();
    await findInput.fill("needle");

    await expect(findResults).toHaveText("1/3");
    await expect(glyph.window.locator(".glyph-find-match")).toHaveCount(3);
    await expect(glyph.window.locator(".glyph-find-match-active")).toHaveCount(1);

    await glyph.window.keyboard.press("Enter");
    await expect(findResults).toHaveText("2/3");

    await glyph.window.keyboard.press("Shift+Enter");
    await expect(findResults).toHaveText("1/3");

    await glyph.window.keyboard.press("Escape");
    await expect(findInput).toBeHidden();
    await expect
      .poll(async () =>
        glyph.window.evaluate(() => {
          const activeElement = document.activeElement;
          return Boolean(activeElement?.closest('[data-glyph-editor="true"]'));
        }),
      )
      .toBe(true);
  } finally {
    await glyph.stop(testInfo);
  }
});

test("hovering a markdown note link shows a local note preview", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);
    const nestedLink = glyph.window
      .locator('[data-glyph-editor="true"] a')
      .filter({ hasText: "Nested Note" })
      .first();
    await expect(nestedLink).toBeVisible();

    await nestedLink.hover();

    const previewCard = glyph.window.getByLabel("Note link preview");
    await expect(previewCard).toBeVisible();
    await expect(previewCard.getByText("Nested Note", { exact: true })).toBeVisible();
    await expect(previewCard.getByText("Nested note body.")).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("opens notes in multiple tabs and switches between them with keyboard shortcuts", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);
    await expect(glyph.window.getByText("Smoke test note content.")).toBeVisible();
    await expect(glyph.window.getByRole("tab", { name: /welcome/i })).toBeVisible();

    await selectPaletteItem(glyph.window, "nested", /nested-note\.md/i);
    await expect(glyph.window.getByText("Nested note body.")).toBeVisible();
    await expect(glyph.window.getByRole("tab", { name: /welcome/i })).toBeVisible();
    await expect(glyph.window.getByRole("tab", { name: /nested-note/i })).toBeVisible();

    const tabState = await getTabState(glyph.window, {
      workspaceRoot: glyph.sandbox.workspaceRoot,
    });
    expect(tabState.tabs).toHaveLength(2);
    const [firstTab, secondTab] = tabState.tabs;
    expect(firstTab).toBeDefined();
    expect(secondTab).toBeDefined();

    await triggerTabSwitchShortcut(glyph.window, 1);
    await expect(
      glyph.window.getByText(getExpectedBodyForTabTitle(firstTab?.title ?? null)),
    ).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, firstTab?.title ?? null);

    await triggerTabSwitchShortcut(glyph.window, 2);
    await expect(
      glyph.window.getByText(getExpectedBodyForTabTitle(secondTab?.title ?? null)),
    ).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, secondTab?.title ?? null);
    await expect
      .poll(async () => (await readPersistedSession(glyph.window))?.noteFilePath ?? null, {
        timeout: 15_000,
      })
      .toBe(secondTab?.title ?? null);

    await triggerCloseOtherTabsShortcut(glyph.window);
    await expect
      .poll(
        async () =>
          (
            await getTabState(glyph.window, {
              workspaceRoot: glyph.sandbox.workspaceRoot,
            })
          ).tabs.map((tab) => tab.title),
        {
          timeout: 15_000,
        },
      )
      .toEqual(secondTab?.title ? [secondTab.title] : []);
    await expect(
      glyph.window.getByText(getExpectedBodyForTabTitle(secondTab?.title ?? null)),
    ).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, secondTab?.title ?? null);

    const reopenedTabFileName = getTabFileName(firstTab?.title ?? null);
    expect(reopenedTabFileName).toBeTruthy();

    await selectPaletteItem(
      glyph.window,
      reopenedTabFileName!.replace(/\.md$/i, ""),
      new RegExp(escapeRegExp(reopenedTabFileName!), "i"),
    );
    await expect
      .poll(
        async () =>
          (
            await getTabState(glyph.window, {
              workspaceRoot: glyph.sandbox.workspaceRoot,
            })
          ).tabs.map((tab) => tab.title),
        {
          timeout: 15_000,
        },
      )
      .toEqual(
        [secondTab?.title ?? null, firstTab?.title ?? null].filter((title): title is string =>
          Boolean(title),
        ),
      );

    await selectPaletteItem(glyph.window, "close current tab", /close current tab/i);
    await expect
      .poll(
        async () =>
          (
            await getTabState(glyph.window, {
              workspaceRoot: glyph.sandbox.workspaceRoot,
            })
          ).tabs.map((tab) => tab.title),
        {
          timeout: 15_000,
        },
      )
      .toEqual(secondTab?.title ? [secondTab.title] : []);
    await expect(
      glyph.window.getByText(getExpectedBodyForTabTitle(secondTab?.title ?? null)),
    ).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("supports last-tab and adjacent tab keyboard shortcuts across long tab rails", async ({}, testInfo) => {
  const sandbox = await createGlyphSandbox();
  const generatedTabs = Array.from({ length: 8 }, (_, index) => {
    const label = String(index + 1).padStart(2, "0");
    return {
      label,
      fileName: `tab-${label}.md`,
      query: `body ${label}`,
      titlePattern: new RegExp(`tab-${label}\\.md`, "i"),
    };
  });

  await Promise.all(
    generatedTabs.map((tab) =>
      fs.writeFile(
        path.join(sandbox.workspaceRoot, tab.fileName),
        [`# Tab ${tab.label}`, "", `Body ${tab.label}.`].join("\n"),
      ),
    ),
  );

  const glyph = await launchGlyph(sandbox);

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);
    await selectPaletteItem(glyph.window, "nested", /nested-note\.md/i);

    for (const tab of generatedTabs) {
      await selectPaletteItem(glyph.window, tab.query, tab.titlePattern);
    }

    const tabState = await getTabState(glyph.window, {
      workspaceRoot: sandbox.workspaceRoot,
    });
    expect(tabState.tabs).toHaveLength(10);

    const firstTabTitle = tabState.tabs[0]?.title ?? null;
    const lastTabTitle = tabState.tabs.at(-1)?.title ?? null;
    const previousToLastTabTitle = tabState.tabs.at(-2)?.title ?? null;
    expect(firstTabTitle).toBeTruthy();
    expect(lastTabTitle).toBeTruthy();
    expect(previousToLastTabTitle).toBeTruthy();

    await triggerTabSwitchShortcut(glyph.window, 9);
    await expect(glyph.window.getByText(getExpectedBodyForTabTitle(lastTabTitle))).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, lastTabTitle);

    await triggerNextTabShortcut(glyph.window);
    await expect(glyph.window.getByText(getExpectedBodyForTabTitle(firstTabTitle))).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, firstTabTitle);

    await triggerPreviousTabShortcut(glyph.window);
    await expect(glyph.window.getByText(getExpectedBodyForTabTitle(lastTabTitle))).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, lastTabTitle);

    await triggerPreviousTabShortcut(glyph.window);
    await expect(
      glyph.window.getByText(getExpectedBodyForTabTitle(previousToLastTabTitle)),
    ).toBeVisible();
    await expectTabSelectedByTitle(glyph.window, previousToLastTabTitle);
  } finally {
    await glyph.stop(testInfo);
    await sandbox.cleanup();
  }
});

test("creates and closes tabs from shortcuts and restores tab sessions after relaunch", async ({}, testInfo) => {
  const sandbox = await createGlyphSandbox();
  let firstRun: GlyphHarness | null = null;
  let secondRun: GlyphHarness | null = null;

  try {
    firstRun = await launchGlyph(sandbox);
    await expectAppShell(firstRun.window);
    await openWorkspace(firstRun.window, sandbox.workspaceRoot);
    await selectPaletteItem(firstRun.window, "welcome", /welcome/i);
    await expect(firstRun.window.getByRole("tab", { name: /welcome/i })).toBeVisible();

    await firstRun.window.keyboard.press(`${modKey}+N`);
    await expect(firstRun.window.getByRole("tab", { name: /Untitled-/ })).toBeVisible();

    const paletteInput = await openCommandPalette(firstRun.window);
    await paletteInput.fill("close current tab");
    await expect(
      firstRun.window.getByRole("option", { name: /close current tab/i }).first(),
    ).toBeVisible();
    await firstRun.window.keyboard.press("Escape");

    await firstRun.window.keyboard.press(`${modKey}+W`);
    await expect(firstRun.window.getByRole("tab", { name: /Untitled-/ })).toBeHidden();

    await selectPaletteItem(firstRun.window, "nested", /nested-note/i);
    await expect(firstRun.window.getByText("Nested note body.")).toBeVisible();
    const tabStateBeforeReorder = await getTabState(firstRun.window, {
      workspaceRoot: sandbox.workspaceRoot,
    });
    const tabTitlesBeforeReorder = tabStateBeforeReorder.tabs
      .map((tab) => tab.title)
      .filter((title): title is string => Boolean(title));
    expect(tabTitlesBeforeReorder).toHaveLength(2);

    await dragTabBefore(firstRun.window, 1, 0);

    const reorderedTabTitles = [...tabTitlesBeforeReorder].reverse();
    const activeRestoredTitle =
      tabStateBeforeReorder.tabs.find((tab) => tab.selected === "true")?.title ?? null;
    expect(activeRestoredTitle).toBeTruthy();

    await expect
      .poll(
        async () =>
          (
            await getTabState(firstRun.window, {
              workspaceRoot: sandbox.workspaceRoot,
            })
          ).tabs.map((tab) => tab.title),
        {
          timeout: 15_000,
        },
      )
      .toEqual(reorderedTabTitles);

    await expect
      .poll(async () => (await readPersistedSession(firstRun.window))?.noteFilePath ?? null, {
        timeout: 15_000,
      })
      .toBe(activeRestoredTitle);

    await triggerTabSwitchShortcut(firstRun.window, 1);
    await expect(
      firstRun.window.getByText(getExpectedBodyForTabTitle(reorderedTabTitles[0] ?? null)),
    ).toBeVisible();
    const activeTitleAfterShortcut = reorderedTabTitles[0] ?? null;

    const persistedTabPaths = (
      await getTabState(firstRun.window, {
        workspaceRoot: sandbox.workspaceRoot,
      })
    ).tabs
      .map((tab) => tab.title)
      .filter((title): title is string => Boolean(title));

    await expect
      .poll(async () => readPersistedSession(firstRun.window), {
        timeout: 15_000,
      })
      .toMatchObject({
        noteFilePath: activeTitleAfterShortcut,
        noteTabPaths: persistedTabPaths,
        noteWorkspacePath: sandbox.workspaceRoot,
      });

    await firstRun.stop(testInfo);
    firstRun = null;

    secondRun = await launchGlyph(sandbox);
    await expectAppShell(secondRun.window);
    await expect
      .poll(
        async () =>
          (
            await getTabState(secondRun.window, {
              workspaceRoot: sandbox.workspaceRoot,
            })
          ).tabs.map((tab) => tab.title),
        {
          timeout: 15_000,
        },
      )
      .toEqual(persistedTabPaths);
    await expect(secondRun.window.getByRole("tab", { name: /welcome/i })).toBeVisible();
    await expect(secondRun.window.getByRole("tab", { name: /nested-note/i })).toBeVisible();
    await expect(
      secondRun.window.getByText(getExpectedBodyForTabTitle(activeTitleAfterShortcut)),
    ).toBeVisible();
    await expectTabSelectedByTitle(secondRun.window, activeTitleAfterShortcut);
  } finally {
    if (firstRun) {
      await firstRun.stop(testInfo);
    }

    if (secondRun) {
      await secondRun.stop(testInfo);
    }

    await sandbox.cleanup();
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

test("zoom controls appear in toolbar when a note is open", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // Zoom controls should be visible in the toolbar
    const zoomInButton = glyph.window.getByRole("button", { name: "Zoom in" });
    const zoomOutButton = glyph.window.getByRole("button", { name: "Zoom out" });

    await expect(zoomInButton).toBeVisible();
    await expect(zoomOutButton).toBeVisible();

    // Default zoom level should be 100%
    await expect(glyph.window.getByRole("button", { name: /100%/ })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("zoom in increases editor scale", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // Click zoom in button
    const zoomInButton = glyph.window.getByRole("button", { name: "Zoom in" });
    await zoomInButton.click();

    // Settings should persist the new zoom level
    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(110);
  } finally {
    await glyph.stop(testInfo);
  }
});

test("zoom out decreases editor scale", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // Click zoom out button twice
    const zoomOutButton = glyph.window.getByRole("button", { name: "Zoom out" });
    await zoomOutButton.click();
    await zoomOutButton.click();

    // Settings should persist the new zoom level
    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(80);
  } finally {
    await glyph.stop(testInfo);
  }
});

test("reset zoom to 100% via click on percentage", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // Zoom in first (settings file should now have 110)
    const zoomInButton = glyph.window.getByRole("button", { name: "Zoom in" });
    await zoomInButton.click();

    // Wait for settings to persist
    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(110);

    // Click the zoom percentage button to reset it to 100%
    const zoomLevelButton = glyph.window.locator("button", { hasText: /110%/ });
    await zoomLevelButton.click();

    // Should return to 100%
    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(100);
  } finally {
    await glyph.stop(testInfo);
  }
});

test("zoom in via keyboard shortcut increases editor scale", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // Default zoom should be 100%
    await expect(glyph.window.getByRole("button", { name: /100%/ })).toBeVisible();

    // Press Ctrl++ (Zoom In) - using + key which is Shift+= on most keyboards
    await glyph.window.keyboard.press(`${modKey}++`);

    // Settings should persist the new zoom level (100 + 10 = 110)
    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(110);

    // Button should now show 110%
    await expect(glyph.window.getByRole("button", { name: /110%/ })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});

test("zoom reset via keyboard shortcut returns to 100%", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome\.md/i);

    // Zoom in first
    const zoomInButton = glyph.window.getByRole("button", { name: "Zoom in" });
    await zoomInButton.click();

    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(110);

    // Press Ctrl+0 (Reset Zoom)
    await glyph.window.keyboard.press(`${modKey}+0`);

    // Settings should return to 100
    await expect
      .poll(async () => {
        const settings = await readJson<{
          editorPreferences?: { editorScale?: number };
        }>(glyph.sandbox.settingsPath);
        return settings?.editorPreferences?.editorScale ?? null;
      })
      .toBe(100);

    // Button should show 100%
    await expect(glyph.window.getByRole("button", { name: /100%/ })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});
