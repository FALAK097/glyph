import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  variant?: "destructive" | "default";
};

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Delete",
  variant = "destructive",
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={variant} type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SidebarDeleteTarget = {
  path: string;
  name: string;
};

type SidebarRemoveTarget = {
  path: string;
  name: string;
};

type SidebarDeleteDialogsProps = {
  nodeToDelete: SidebarDeleteTarget | null;
  folderToDelete: SidebarDeleteTarget | null;
  folderToRemove: SidebarRemoveTarget | null;
  fileToRemove: SidebarRemoveTarget | null;
  onConfirmDelete: () => void;
  onConfirmDeleteFolder: () => void;
  onConfirmRemoveFile: () => void;
  onConfirmRemoveFolder: () => void;
  onDismissDelete: () => void;
  onDismissDeleteFolder: () => void;
  onDismissRemoveFile: () => void;
  onDismissRemoveFolder: () => void;
};

export function SidebarDeleteDialogs({
  nodeToDelete,
  folderToDelete,
  folderToRemove,
  fileToRemove,
  onConfirmDelete,
  onConfirmDeleteFolder,
  onConfirmRemoveFile,
  onConfirmRemoveFolder,
  onDismissDelete,
  onDismissDeleteFolder,
  onDismissRemoveFile,
  onDismissRemoveFolder,
}: SidebarDeleteDialogsProps) {
  return (
    <>
      {nodeToDelete ? (
        <DeleteDialog
          open={!!nodeToDelete}
          onOpenChange={(open) => {
            if (!open) onDismissDelete();
          }}
          title="Delete Note"
          description={
            <>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">"{nodeToDelete.name}"</span>? This
              action cannot be undone.
            </>
          }
          onConfirm={onConfirmDelete}
        />
      ) : null}

      {folderToDelete ? (
        <DeleteDialog
          open={!!folderToDelete}
          onOpenChange={(open) => {
            if (!open) onDismissDeleteFolder();
          }}
          title="Delete Folder"
          description={
            <>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">"{folderToDelete.name}"</span> and all
              its contents? This action cannot be undone.
            </>
          }
          onConfirm={onConfirmDeleteFolder}
        />
      ) : null}

      {folderToRemove ? (
        <DeleteDialog
          open={!!folderToRemove}
          onOpenChange={(open) => {
            if (!open) onDismissRemoveFolder();
          }}
          title="Remove Folder From Glyph"
          description={
            <>
              Remove <span className="font-semibold text-foreground">"{folderToRemove.name}"</span>{" "}
              from Glyph? This only removes it from the sidebar and does not delete anything from
              your device.
            </>
          }
          onConfirm={onConfirmRemoveFolder}
          confirmLabel="Remove"
          variant="default"
        />
      ) : null}

      {fileToRemove ? (
        <DeleteDialog
          open={!!fileToRemove}
          onOpenChange={(open) => {
            if (!open) onDismissRemoveFile();
          }}
          title="Remove Note From Glyph"
          description={
            <>
              Remove <span className="font-semibold text-foreground">"{fileToRemove.name}"</span>{" "}
              from Glyph? This only hides it from the app and does not delete the file from your
              device.
            </>
          }
          onConfirm={onConfirmRemoveFile}
          confirmLabel="Remove"
          variant="default"
        />
      ) : null}
    </>
  );
}
