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
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = pending !== null;
  const prevOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (justOpened) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
          ref={inputRef}
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
