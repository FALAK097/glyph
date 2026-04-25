import type { MarkdownEditorToast } from "../types/markdown-editor";

import { CheckCircleIcon } from "@/components/icons";

type EditorFooterProps = {
  wordCount: number;
  readingTime: number;
  footerMetaLabel?: string;
  saveStateLabel?: string;
  toast: MarkdownEditorToast | null;
};

export function EditorFooter({
  wordCount,
  readingTime,
  footerMetaLabel,
  saveStateLabel,
  toast,
}: EditorFooterProps) {
  return (
    <>
      <div className="absolute bottom-6 right-10 flex items-center gap-3 rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-sm z-30 pointer-events-none">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span>{wordCount} words</span>
        </div>
        <div className="w-[1px] h-3 bg-border" />
        <span className="text-xs text-muted-foreground">{readingTime} min read</span>
        {footerMetaLabel ? (
          <>
            <div className="w-[1px] h-3 bg-border" />
            <span className="text-xs text-muted-foreground">{footerMetaLabel}</span>
          </>
        ) : null}
        <div className="w-[1px] h-3 bg-border" />
        <p className="text-xs font-medium text-foreground m-0">{saveStateLabel}</p>
      </div>
      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-start gap-3 max-w-[360px] px-4 py-3 bg-card border border-border rounded-lg shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="mt-0.5 text-foreground" aria-hidden="true">
            <CheckCircleIcon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-medium text-foreground leading-snug">{toast.title}</p>
            {toast.description ? (
              <p className="m-0 mt-0.5 text-xs text-muted-foreground leading-snug break-words">
                {toast.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
