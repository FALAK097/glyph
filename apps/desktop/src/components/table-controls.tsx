import type { Editor } from "@tiptap/core";

import { Button } from "@/components/ui/button";

type TableControlsProps = {
  isActive: boolean;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  canDeleteTable: boolean;
  shouldShowOutlineRail: boolean;
  editor: Editor | null;
};

export function TableControls({
  isActive,
  canDeleteRow,
  canDeleteColumn,
  canDeleteTable,
  shouldShowOutlineRail,
  editor,
}: TableControlsProps) {
  if (!isActive) {
    return null;
  }

  return (
    <div className="sticky top-4 z-20 h-0 overflow-visible">
      <div
        className={`pointer-events-none flex justify-center pl-52 pr-6 ${
          shouldShowOutlineRail ? "xl:pr-[316px]" : ""
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border/70 bg-card/95 px-2.5 py-1.5 shadow-lg supports-backdrop-filter:backdrop-blur-sm">
          <Button
            variant="outline"
            size="xs"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().addRowAfter().run()}
          >
            Add Row
          </Button>
          <Button
            variant="outline"
            size="xs"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
          >
            Add Column
          </Button>
          <Button
            variant="outline"
            size="xs"
            type="button"
            disabled={!canDeleteRow}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().deleteRow().run()}
          >
            Remove Row
          </Button>
          <Button
            variant="outline"
            size="xs"
            type="button"
            disabled={!canDeleteColumn}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().deleteColumn().run()}
          >
            Remove Column
          </Button>
          <Button
            variant="outline"
            size="xs"
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
          >
            Toggle Header
          </Button>
          <Button
            variant="destructive"
            size="xs"
            type="button"
            disabled={!canDeleteTable}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().deleteTable().run()}
          >
            Delete Table
          </Button>
        </div>
      </div>
    </div>
  );
}
