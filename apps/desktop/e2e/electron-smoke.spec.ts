import path from "node:path";
import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

const require = createRequire(import.meta.url);
const electronBinary = require("electron") as string;
const desktopRoot = path.resolve(import.meta.dirname, "..");
const isMac = process.platform === "darwin";

test("launches Glyph and opens the command palette", async () => {
  const app = await electron.launch({
    executablePath: electronBinary,
    args: [desktopRoot],
    cwd: desktopRoot,
    env: {
      ...process.env,
      GLYPH_E2E_DIST: "1",
    },
  });

  try {
    const window = await app.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await expect(window.locator('[aria-label="Glyph"]')).toBeVisible();

    await window.keyboard.press(isMac ? "Meta+P" : "Control+P");

    const paletteInput = window.getByLabel("Search notes, skills, and commands…");
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill("settings");
    await window.keyboard.press("Enter");

    await expect(window.getByText("Glyph Desktop")).toBeVisible();
  } finally {
    await app.close();
  }
});
