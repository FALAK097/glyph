import { useCallback, useEffect, useRef } from "react";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type PendingNoteConfirm = {
  kind: "delete" | "remove";
  name: string;
  path: string;
};

type NoteConfirmDialogProps = {
  pending: PendingNoteConfirm | null;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function NoteConfirmDialog({ pending, onDismiss, onConfirm }: NoteConfirmDialogProps) {
  const confirmCancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      confirmCancelRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pending]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  if (!pending) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {pending.kind === "remove" ? "Remove Current Note From Glyph" : "Delete Current Note"}
          </DialogTitle>
          <DialogDescription>
            {pending.kind === "remove"
              ? `Remove "${pending.name}" from Glyph? This only hides it from the app and does not delete the file from your device.`
              : `Delete "${pending.name}" from your device? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={confirmCancelRef} variant="outline" type="button" onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            variant={pending.kind === "delete" ? "destructive" : "default"}
            type="button"
            onClick={onConfirm}
          >
            {pending.kind === "remove" ? "Remove" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
