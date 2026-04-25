import { test } from "@playwright/test";

import { launchGlyph } from "../helpers";
import { expectAppShell, selectPaletteItem } from "../navigation";

test("launches Glyph and opens settings from the command palette", async ({}, testInfo) => {
  const glyph = await launchGlyph();

  try {
    await expectAppShell(glyph.window);
    await glyph.window.evaluate(async (ws) => {
      const glyphApi = (
        window as Window & { glyph: { openFolder: (p: string) => Promise<{ rootPath: string }> } }
      ).glyph;
      await glyphApi.openFolder(ws);
    }, glyph.sandbox.workspaceRoot);
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
    await glyph.window.evaluate(async (ws) => {
      const glyphApi = (
        window as Window & { glyph: { openFolder: (p: string) => Promise<{ rootPath: string }> } }
      ).glyph;
      await glyphApi.openFolder(ws);
    }, glyph.sandbox.workspaceRoot);
    await selectPaletteItem(glyph.window, "welcome", /welcome/i);

    await expect(glyph.window.getByText("Smoke test note content.")).toBeVisible();
    await expect(glyph.window.getByRole("heading", { name: "Welcome to Glyph" })).toBeVisible();
  } finally {
    await glyph.stop(testInfo);
  }
});
