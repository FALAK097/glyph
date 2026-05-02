import { useCallback } from "react";

import type { FileDocument } from "@/core/workspace";
import type { NavigationEntry } from "@/store/workspace";
import { useWorkspaceStore } from "@/store/workspace";

type UseNavigationControllerOptions = {
  glyph: NonNullable<Window["glyph"]>;
  syncOpenedFile: (file: FileDocument, options?: { recordHistory?: boolean }) => Promise<void>;
  activateNoteTab: (path: string) => Promise<void>;
  onRestoreSkill: (path: string) => Promise<void>;
  onRestoreTasks: () => void;
};

export function useNavigationController({
  glyph,
  syncOpenedFile,
  activateNoteTab,
  onRestoreSkill,
  onRestoreTasks,
}: UseNavigationControllerOptions) {
  // Subscribe to the index/history length directly so the component re-renders
  // when navigation state changes (canGoBack/canGoForward are stable function
  // references and do NOT trigger re-renders on their own).
  const canGoBack = useWorkspaceStore((s) => s.navigationIndex > 0);
  const canGoForward = useWorkspaceStore((s) => s.navigationIndex < s.navigationHistory.length - 1);
  const goBack = useWorkspaceStore((s) => s.goBack);
  const goForward = useWorkspaceStore((s) => s.goForward);

  const restoreEntry = useCallback(
    async (entry: NavigationEntry) => {
      if (entry.kind === "note") {
        const existingTab = useWorkspaceStore.getState().getTabByPath(entry.path);
        if (existingTab) {
          await activateNoteTab(entry.path);
        } else {
          const file = await glyph.readFile(entry.path);
          await syncOpenedFile(file);
        }
      } else if (entry.kind === "skill") {
        await onRestoreSkill(entry.path);
      } else {
        onRestoreTasks();
      }
    },
    [glyph, syncOpenedFile, activateNoteTab, onRestoreSkill, onRestoreTasks],
  );

  const navigateBack = useCallback(async () => {
    const entry = goBack();
    if (entry) {
      await restoreEntry(entry);
    }
  }, [goBack, restoreEntry]);

  const navigateForward = useCallback(async () => {
    const entry = goForward();
    if (entry) {
      await restoreEntry(entry);
    }
  }, [goForward, restoreEntry]);

  return {
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
  };
}
