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
import { Input } from "./ui/input";

type PendingNoteRename = {
  name: string;
  path: string;
  value: string;
};

type NoteRenameDialogProps = {
  pending: PendingNoteRename | null;
  currentDisplayName: string;
  onDismiss: () => void;
  onConfirm: () => void;
  onValueChange: (value: string) => void;
};

export function NoteRenameDialog({
  pending,
  currentDisplayName,
  onDismiss,
  onConfirm,
  onValueChange,
}: NoteRenameDialogProps) {
  const noteRenameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      noteRenameInputRef.current?.focus();
      noteRenameInputRef.current?.select();
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

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    },
    [onConfirm],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(event.target.value);
    },
    [onValueChange],
  );

  if (!pending) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Rename Current Note</DialogTitle>
          <DialogDescription>
            Update{" "}
            <span className="font-semibold text-foreground">
              "{currentDisplayName || pending.name}"
            </span>{" "}
            without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <Input
          ref={noteRenameInputRef}
          aria-label="New note name"
          autoFocus
          value={pending.value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onDismiss}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
