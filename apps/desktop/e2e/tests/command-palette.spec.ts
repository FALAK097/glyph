import { test } from "@playwright/test";

import { launchGlyph } from "../helpers";
import { expectAppShell, openCommandPalette, selectPaletteItem } from "../navigation";

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
    await glyph.window.evaluate(async (ws) => {
      const glyphApi = (
        window as Window & { glyph: { openFolder: (p: string) => Promise<{ rootPath: string }> } }
      ).glyph;
      await glyphApi.openFolder(ws);
    }, glyph.sandbox.workspaceRoot);

    const paletteInput = await openCommandPalette(glyph.window);
    await paletteInput.fill("nested");

    await expect(glyph.window.getByRole("option", { name: /nested-note/ }).first()).toBeVisible();
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
