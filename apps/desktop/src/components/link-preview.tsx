import { memo } from "react";
import type { HoveredLinkState } from "../types/markdown-editor";

type LinkPreviewProps = {
  hoveredLink: HoveredLinkState | null;
  linkOpenShortcutHint: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export const LinkPreview = memo(function LinkPreview({
  hoveredLink,
  linkOpenShortcutHint,
  onMouseEnter,
  onMouseLeave,
}: LinkPreviewProps) {
  if (!hoveredLink) {
    return null;
  }

  return (
    <div
      className={`fixed z-30 ${hoveredLink.status === "preview" && hoveredLink.preview ? "w-[min(320px,calc(100vw-2rem))]" : ""}`}
      style={{
        left: hoveredLink.tooltipLeft,
        top: hoveredLink.tooltipTop,
        transform:
          hoveredLink.placement === "above"
            ? "translate(-50%, calc(-100% - 4px))"
            : "translateX(-50%)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {hoveredLink.status === "preview" && hoveredLink.preview ? (
        <div
          aria-label="Note link preview"
          className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg supports-backdrop-filter:backdrop-blur-sm"
        >
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{hoveredLink.preview.title}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {hoveredLink.preview.displayPath}
              </p>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {hoveredLink.preview.excerpt || "This note does not have preview text yet."}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">{linkOpenShortcutHint}</p>
          </div>
        </div>
      ) : hoveredLink.status === "loading" ? (
        <div
          aria-label="Loading preview"
          className="rounded-xl border border-border/60 bg-card/95 px-3 py-2 shadow-md supports-backdrop-filter:backdrop-blur-sm"
        >
          <p className="text-xs text-muted-foreground">Loading&hellip;</p>
        </div>
      ) : (
        <div
          aria-label="Link hint"
          className="rounded-xl border border-border/60 bg-card/95 px-3 py-1.5 shadow-md supports-backdrop-filter:backdrop-blur-sm"
        >
          <p className="text-xs text-muted-foreground">{linkOpenShortcutHint}</p>
        </div>
      )}
    </div>
  );
});
