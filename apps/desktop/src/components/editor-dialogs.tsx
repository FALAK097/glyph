import { useCallback, useEffect, useRef, useState } from "react";

import type { Editor } from "@tiptap/core";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TableFormState = {
  rows: string;
  cols: string;
};

type LinkFormState = {
  text: string;
  href: string;
};

type ImageFormState = {
  alt: string;
  src: string;
  _nonce?: number;
};

type EditorDialogsProps = {
  activeDialog: "insert-table" | "insert-link" | "insert-image" | null;
  onDialogChange: (dialog: "insert-table" | "insert-link" | "insert-image" | null) => void;
  editor: Editor | null;
  showToast: (title: string, description: string) => void;
  onPickImageFile: () => Promise<void>;
  imageFormState?: { alt: string; src: string; _nonce?: number } | null;
  onClearImageFormState?: () => void;
};

const normalizeLinkTarget = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-z]+:/i.test(trimmed) && !/^(https?:\/\/|file:\/\/|glyph-local:\/\/)/i.test(trimmed)) {
    return "";
  }

  if (/^(https?:\/\/|file:\/\/|glyph-local:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

export function EditorDialogs({
  activeDialog,
  onDialogChange,
  editor,
  showToast,
  onPickImageFile,
  imageFormState,
  onClearImageFormState,
}: EditorDialogsProps) {
  const [tableForm, setTableForm] = useState<TableFormState>({
    rows: "3",
    cols: "3",
  });
  const [linkForm, setLinkForm] = useState<LinkFormState>({
    text: "",
    href: "",
  });
  const [imageForm, setImageForm] = useState<ImageFormState>({
    alt: "",
    src: "",
  });

  // Nonce tracks each dialog open so late picker results from a previous
  // session are ignored (e.g. user opens dialog, picks file, closes dialog,
  // re-opens — the stale pick must not overwrite the fresh form).
  // The nonce is captured by the parent when the picker is INITIATED and
  // attached as _nonce on imageFormState; only results whose _nonce matches
  // the current dialog session are applied.
  const imageDialogNonceRef = useRef(0);

  useEffect(() => {
    if (activeDialog === "insert-image") {
      imageDialogNonceRef.current += 1;
    }
  }, [activeDialog]);

  useEffect(() => {
    if (
      imageFormState &&
      activeDialog === "insert-image" &&
      imageFormState._nonce === imageDialogNonceRef.current
    ) {
      setImageForm({ alt: imageFormState.alt, src: imageFormState.src });
    }
  }, [imageFormState, activeDialog]);

  const handleInsertTable = useCallback(() => {
    if (!editor) {
      return;
    }

    const rows = Math.min(12, Math.max(2, Number.parseInt(tableForm.rows, 10) || 3));
    const cols = Math.min(8, Math.max(1, Number.parseInt(tableForm.cols, 10) || 3));

    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    onDialogChange(null);
    showToast("Table inserted", `${rows} rows and ${cols} columns ready.`);
  }, [editor, tableForm, onDialogChange, showToast]);

  const handleInsertLink = useCallback(() => {
    if (!editor) {
      return;
    }

    const href = normalizeLinkTarget(linkForm.href);
    if (!href) {
      showToast("Link missing", "Add a URL or choose a file.");
      return;
    }

    const text = linkForm.text.trim() || href.replace(/^https?:\/\//i, "");
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "text",
          text,
          marks: [
            {
              type: "link",
              attrs: { href },
            },
          ],
        },
      ])
      .run();
    onDialogChange(null);
    showToast("Link inserted", href);
  }, [editor, linkForm, onDialogChange, showToast]);

  const handleInsertImage = useCallback(() => {
    if (!editor) {
      return;
    }

    const src = normalizeLinkTarget(imageForm.src);
    if (!src) {
      showToast("Image missing", "Add an image URL or choose a local image.");
      return;
    }

    editor
      .chain()
      .focus()
      .setImage({
        src,
        alt: imageForm.alt.trim() || "Image",
        title: imageForm.alt.trim() || undefined,
      })
      .run();
    onDialogChange(null);
    showToast("Image inserted", imageForm.alt.trim() || "Image");
  }, [editor, imageForm, onDialogChange, showToast]);

  const handleTableRowsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTableForm((current) => ({
      ...current,
      rows: event.target.value,
    }));
  }, []);

  const handleTableColsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTableForm((current) => ({
      ...current,
      cols: event.target.value,
    }));
  }, []);

  const handleLinkTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLinkForm((current) => ({
      ...current,
      text: event.target.value,
    }));
  }, []);

  const handleLinkHrefChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLinkForm((current) => ({
      ...current,
      href: event.target.value,
    }));
  }, []);

  const handleImageAltChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setImageForm((current) => ({
      ...current,
      alt: event.target.value,
    }));
  }, []);

  const handleImageSrcChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setImageForm((current) => ({
      ...current,
      src: event.target.value,
    }));
  }, []);

  return (
    <>
      <Dialog
        open={activeDialog === "insert-table"}
        onOpenChange={(open) => !open && onDialogChange(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Table</DialogTitle>
            <DialogDescription>
              Start with the right shape, then use the table controls to add or remove rows and
              columns anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm" htmlFor="table-rows-input">
              <span className="font-medium text-foreground">Rows</span>
              <Input
                id="table-rows-input"
                min={2}
                max={12}
                type="number"
                value={tableForm.rows}
                onChange={handleTableRowsChange}
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="table-cols-input">
              <span className="font-medium text-foreground">Columns</span>
              <Input
                id="table-cols-input"
                min={1}
                max={8}
                type="number"
                value={tableForm.cols}
                onChange={handleTableColsChange}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onDialogChange(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertTable}>
              Insert Table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={activeDialog === "insert-link"}
        onOpenChange={(open) => !open && onDialogChange(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Paste a URL and Glyph will normalize bare domains like `example.com` to `https://`
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm" htmlFor="link-label-input">
              <span className="font-medium text-foreground">Label</span>
              <Input
                id="link-label-input"
                value={linkForm.text}
                onChange={handleLinkTextChange}
                placeholder="Open site"
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="link-url-input">
              <span className="font-medium text-foreground">URL</span>
              <Input
                id="link-url-input"
                value={linkForm.href}
                onChange={handleLinkHrefChange}
                placeholder="https://example.com"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onDialogChange(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertLink}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={activeDialog === "insert-image"}
        onOpenChange={(open) => {
          if (!open) {
            onDialogChange(null);
            onClearImageFormState?.();
            setImageForm({ alt: "", src: "" });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
            <DialogDescription>
              Paste an image URL or choose a local file. Local images are served through Glyph so
              they render reliably while editing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm" htmlFor="image-alt-input">
              <span className="font-medium text-foreground">Alt text</span>
              <Input
                id="image-alt-input"
                value={imageForm.alt}
                onChange={handleImageAltChange}
                placeholder="Team logo"
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="image-src-input">
              <span className="font-medium text-foreground">Image source</span>
              <Input
                id="image-src-input"
                value={imageForm.src}
                onChange={handleImageSrcChange}
                placeholder="https://example.com/logo.png"
              />
            </label>
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <p className="m-0 text-xs text-muted-foreground">
                Local images open a native file picker and avoid broken `file://` previews.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                type="button"
                onClick={() => void onPickImageFile()}
              >
                Choose Local Image
              </Button>
            </div>
            {imageForm.src ? (
              <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-2">
                <img
                  alt={imageForm.alt || "Image preview"}
                  className="max-h-40 w-full rounded-lg object-contain"
                  src={normalizeLinkTarget(imageForm.src)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onDialogChange(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsertImage}>
              Insert Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
