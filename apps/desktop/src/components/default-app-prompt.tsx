import { memo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DefaultAppPromptProps } from "../types/default-app-prompt";

const focusMainEditor = () => {
  requestAnimationFrame(() => {
    const main = document.getElementById("main-content");
    if (main) {
      main.focus();
    }
  });
};

export const DefaultAppPrompt = memo(function DefaultAppPrompt({
  isOpen,
  platform,
  onDismiss,
  onMakeDefault,
}: DefaultAppPromptProps) {
  const isMac = platform === "darwin";
  const isWindows = platform === "win32";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          focusMainEditor();
          onDismiss();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Make Glyph Your Default App?</DialogTitle>
          <DialogDescription className="mt-2">
            {isMac
              ? "Glyph can open .md and .mdx files by default, so you can double-click any Markdown file to open it here."
              : "Set Glyph as the default app for .md and .mdx files to open them directly from File Explorer."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onDismiss} className="flex-1">
            Not Now
          </Button>
          <Button onClick={onMakeDefault} className="flex-1">
            {isWindows ? "Set as Default" : "Enable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
