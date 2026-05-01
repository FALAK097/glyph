/* eslint-disable no-empty-pattern */

import fs from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { createGlyphSandbox, launchGlyph } from "../helpers";
import { expectAppShell, openWorkspace } from "../navigation";

test("tasks board creates standalone persisted tasks and columns", async ({}, testInfo) => {
  const sandbox = await createGlyphSandbox();
  const glyph = await launchGlyph(sandbox);

  try {
    await expectAppShell(glyph.window);
    await openWorkspace(glyph.window, glyph.sandbox.workspaceRoot);

    await glyph.window.getByRole("button", { exact: true, name: "TASKS" }).click();
    const todoColumn = glyph.window.locator('section[aria-label="Todo tasks"]');
    await expect(todoColumn).toBeVisible();

    await todoColumn.getByRole("button", { name: "Add a Task" }).click();
    await glyph.window.getByPlaceholder("Task title #project @date").fill("Ship board #glyph");
    await glyph.window.getByRole("button", { exact: true, name: "Add" }).click();
    await expect(todoColumn.getByText("Ship board")).toBeVisible();
    await expect(todoColumn.getByText("#glyph")).toBeVisible();

    await glyph.window.evaluate(async () => {
      const snapshot = await window.glyph?.listTasks();
      const task = snapshot?.tasks.find((entry) => entry.title === "Ship board");
      const column = snapshot?.columns.find((entry) => entry.title === "In Progress");
      if (!task || !column) {
        throw new Error("Missing task or target column");
      }
      await window.glyph?.moveTask({ id: task.id, columnId: column.id, index: 0 });
      await window.glyph?.updateTaskColumn({ id: column.id, collapsed: true });
    });

    const boardPath = path.join(glyph.sandbox.workspaceRoot, ".glyph", "tasks-board.json");
    const board = JSON.parse(await fs.readFile(boardPath, "utf8")) as {
      columns: Array<{ title: string; collapsed: boolean; taskIds: string[] }>;
      tasks: Array<{ title: string; labels: string[]; sourcePath?: string }>;
    };
    expect(board.tasks.find((task) => task.title === "Ship board")?.labels).toContain("glyph");
    expect(board.tasks.find((task) => task.title === "Ship board")?.sourcePath).toBeUndefined();
    expect(board.columns.find((column) => column.title === "In Progress")?.collapsed).toBe(true);
    await expect(
      fs.readFile(path.join(glyph.sandbox.workspaceRoot, "Tasks.md"), "utf8"),
    ).rejects.toThrow();
  } finally {
    await glyph.stop(testInfo);
  }
});
