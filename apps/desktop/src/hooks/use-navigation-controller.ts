import { useCallback } from "react";

import type { FileDocument } from "@/core/workspace";
import { useWorkspaceStore } from "@/store/workspace";

type UseNavigationControllerOptions = {
  glyph: NonNullable<Window["glyph"]>;
  syncOpenedFile: (file: FileDocument, options?: { recordHistory?: boolean }) => Promise<void>;
};

export function useNavigationController({ glyph, syncOpenedFile }: UseNavigationControllerOptions) {
  // Subscribe to the index/history length directly so the component re-renders
  // when navigation state changes (canGoBack/canGoForward are stable function
  // references and do NOT trigger re-renders on their own).
  const canGoBack = useWorkspaceStore((s) => s.navigationIndex > 0);
  const canGoForward = useWorkspaceStore((s) => s.navigationIndex < s.navigationHistory.length - 1);
  const goBack = useWorkspaceStore((s) => s.goBack);
  const goForward = useWorkspaceStore((s) => s.goForward);

  const navigateBack = useCallback(async () => {
    const prevPath = goBack();
    if (prevPath) {
      const file = await glyph.readFile(prevPath);
      await syncOpenedFile(file);
    }
  }, [goBack, glyph, syncOpenedFile]);

  const navigateForward = useCallback(async () => {
    const nextPath = goForward();
    if (nextPath) {
      const file = await glyph.readFile(nextPath);
      await syncOpenedFile(file);
    }
  }, [goForward, glyph, syncOpenedFile]);

  return {
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
  };
}
