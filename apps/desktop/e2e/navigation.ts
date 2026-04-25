import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import type { GlyphApi, TabState, WorkspaceOpened } from "./types";
import { isMac, modKey } from "./helpers";

export async function expectAppShell(window: Page) {
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator('[aria-label="Glyph"]')).toBeVisible();
}

export async function openCommandPalette(window: Page) {
  await window.keyboard.press(`${modKey}+P`);

  const paletteInput = window.getByLabel("Search notes, skills, and commands…");
  await expect(paletteInput).toBeVisible();
  return paletteInput;
}

export async function selectPaletteItem(window: Page, query: string, name: RegExp) {
  const paletteInput = await openCommandPalette(window);
  await paletteInput.fill(query);
  const option = window.locator('[role="option"]').filter({ hasText: name }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(paletteInput).toBeHidden({ timeout: 15_000 });
}

export async function openWorkspace(window: Page, workspaceRoot: string) {
  const workspace = await window.evaluate(async (targetWorkspaceRoot) => {
    const glyph = (window as Window & { glyph: GlyphApi }).glyph;
    return await glyph.openFolder(targetWorkspaceRoot);
  }, workspaceRoot);

  expect(workspace).not.toBeNull();
  expect((workspace as WorkspaceOpened)?.rootPath).toBe(workspaceRoot);
}

export async function triggerTabSwitchShortcut(window: Page, tabNumber: number) {
  await window.keyboard.press(`${modKey}+${tabNumber}`);
}

export async function triggerNextTabShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Meta+Shift+]" : "Control+Tab");
}

export async function triggerPreviousTabShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Meta+Shift+[" : "Control+Shift+Tab");
}

export async function triggerCloseOtherTabsShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Meta+Shift+W" : "Control+Shift+W");
}

export async function getTabState(
  window: Page,
  options?: { workspaceRoot?: string },
): Promise<{
  tabs: TabState[];
  editorText: string | null;
}> {
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

export async function dragTabBefore(window: Page, sourceIndex: number, targetIndex: number) {
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

export async function triggerSplitRightShortcut(window: Page) {
  await window.keyboard.press(isMac ? "Alt+Meta+\\" : "Alt+Control+\\");
}

export async function getSplitPaneTabTitles(window: Page) {
  return await window.evaluate(() =>
    Array.from(document.querySelectorAll('[role="tablist"]')).map((tablist) =>
      Array.from(tablist.querySelectorAll('[role="tab"]'))
        .map((tab) => tab.getAttribute("title"))
        .filter((title): title is string => Boolean(title)),
    ),
  );
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getTabFileName(title: string | null) {
  return title ? path.basename(title) : null;
}

export async function expectTabSelectedByTitle(window: Page, title: string | null) {
  await expect
    .poll(async () => {
      const tabState = await getTabState(window);
      return tabState.tabs.find((tab) => tab.title === title)?.selected ?? null;
    })
    .toBe("true");
}

export function getExpectedBodyForTabTitle(title: string | null, fallback: string | null = null) {
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

  if (fallback !== null) {
    return fallback;
  }

  throw new Error(`Unexpected tab title: ${title ?? "null"}`);
}

export async function readJson<T>(targetPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readPersistedSession(window: Page) {
  return await window.evaluate(() => {
    const rawSession = window.localStorage.getItem("glyph.editor-session");
    if (!rawSession) {
      return null;
    }

    const parsedSession = JSON.parse(rawSession) as {
      state?: import("./types").PersistedSessionState;
    };

    return parsedSession.state ?? null;
  });
}
