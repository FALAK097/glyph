import { useCallback, useRef } from "react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { EditorPaneProps, ToolbarAction } from "../types/editor-pane";

const toolbarActions: ToolbarAction[] = [
  { label: "H1", insert: (selected) => `# ${selected || "Heading"}` },
  { label: "Bold", insert: (selected) => `**${selected || "bold text"}**` },
  { label: "Italic", insert: (selected) => `*${selected || "italic text"}*` },
  { label: "Link", insert: (selected) => `[${selected || "link text"}](https://example.com)` },
  {
    label: "Code",
    insert: (selected) =>
      selected.includes("\n") ? `\`\`\`\n${selected}\n\`\`\`` : `\`${selected || "code"}\``,
  },
  { label: "Task", insert: (selected) => `- [ ] ${selected || "todo"}` },
  { label: "Quote", insert: (selected) => `> ${selected || "Quote"}` },
  { label: "Rule", insert: () => "\n---\n" },
];

export const EditorPane = ({
  content,
  path,
  isDirty,
  isSaving,
  saveStateLabel,
  onChange,
  onSave,
}: EditorPaneProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyToolbarAction = useCallback(
    (action: ToolbarAction) => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = content.slice(0, start);
      const selected = content.slice(start, end);
      const after = content.slice(end);
      const inserted = action.insert(selected);

      onChange(`${before}${inserted}${after}`);

      requestAnimationFrame(() => {
        const nextCaret = start + inserted.length;
        textarea.focus();
        textarea.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [content, onChange],
  );

  const handleTextareaChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <section className="h-full flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-6 px-6 pt-5 pb-4 border-b border-border/60">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
            Editor
          </p>
          <h2 className="text-lg font-semibold text-foreground truncate">
            {path?.split(/[\\/]/).at(-1) ?? "No file selected"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{saveStateLabel}</p>
        </div>
        <Button
          size="sm"
          variant={!path || !isDirty || isSaving ? "outline" : "default"}
          onClick={onSave}
          type="button"
          disabled={!path || !isDirty || isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
      <div className="px-6 py-3 border-b border-border/40 flex flex-wrap gap-1">
        {toolbarActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="xs"
            type="button"
            disabled={!path}
            onClick={() => applyToolbarAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <Textarea
        ref={textareaRef}
        className="flex-1 min-h-0 w-full resize-none rounded-none border-0 bg-background px-6 py-4 text-sm leading-relaxed shadow-none focus-visible:ring-0"
        value={content}
        onChange={handleTextareaChange}
        placeholder="Open a markdown file to start writing."
        spellCheck={false}
      />
    </section>
  );
};
