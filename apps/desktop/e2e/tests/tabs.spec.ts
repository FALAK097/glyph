import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import { createGlyphSandbox, launchGlyph, modKey } from "../helpers";
import {
  dragTabBefore,
  escapeRegExp,
  expectAppShell,
  expectTabSelectedByTitle,
  getExpectedBodyForTabTitle,
  getTabFileName,
  getTabState,
  openCommandPalette,
  readPersistedSession,
  selectPaletteItem,
  triggerCloseOtherTabsShortcut,
  triggerNextTabShortcut,
  triggerPreviousTabShortcut,
  triggerTabSwitchShortcut,
} from "../navigation";

test("opens notes in multiple tabs and switches between them with keyboard shortcuts", async ({}, testInfo) => {
  const glyph = await launchGlyph();
  try {
    await expectAppShell(glyph.window);
    await glyph.window.evaluate(async (ws) => {
      const glyphApi = (
        window as Window & { glyph: { openFolder: (p: string) => Promise<{ rootPath: string }> } }
      ).glyph;
      await glyphApi.openFolder(ws);
    }, glyph.sandbox.workspaceRoot);

    await selectPaletteItem(glyph.window, "welcome", /welcome/i);
    await expect(glyph.window.getByText("Smoke test note content.")).toBeVisible();
    await expect(glyph.window.getByRole("tab", { name: /welcome/i })).toBeVisible();

    await selectPaletteItem(glyph.window, "nested", /nested-note/i);
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
    await glyph.window.evaluate(async (ws) => {
      const glyphApi = (
        window as Window & { glyph: { openFolder: (p: string) => Promise<{ rootPath: string }> } }
      ).glyph;
      await glyphApi.openFolder(ws);
    }, sandbox.workspaceRoot);

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
  let firstRun: ReturnType<typeof launchGlyph> | null = null;
  let secondRun: ReturnType<typeof launchGlyph> | null = null;

  try {
    firstRun = await launchGlyph(sandbox);
    await expectAppShell(firstRun.window);
    await firstRun.window.evaluate(async (ws) => {
      const glyphApi = (
        window as Window & { glyph: { openFolder: (p: string) => Promise<{ rootPath: string }> } }
      ).glyph;
      await glyphApi.openFolder(ws);
    }, sandbox.workspaceRoot);
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
