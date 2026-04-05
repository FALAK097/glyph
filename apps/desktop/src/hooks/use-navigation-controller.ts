import { useCallback } from "react";

import type { FileDocument } from "@/shared/workspace";
import { useWorkspaceStore } from "@/store/workspace";

type UseNavigationControllerOptions = {
  glyph: NonNullable<Window["glyph"]>;
  syncOpenedFile: (file: FileDocument, options?: { recordHistory?: boolean }) => Promise<void>;
};

export function useNavigationController({ glyph, syncOpenedFile }: UseNavigationControllerOptions) {
  const { canGoBack, canGoForward, goBack, goForward } = useWorkspaceStore();

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
