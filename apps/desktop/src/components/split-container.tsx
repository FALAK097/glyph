import { memo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { useLayoutStore } from "@/store/layout";
import type { LayoutNode } from "@/shared/workspace";

import { EditorPane } from "./editor-pane";

// ─── Resize handle ───────────────────────────────────────────────────

const HANDLE_HIT_TARGET_CLASS = {
  horizontal: "h-full w-2",
  vertical: "h-2 w-full",
} as const;

function ResizeHandle({ direction }: { direction: "horizontal" | "vertical" }) {
  const isVertical = direction === "vertical";

  return (
    <Separator
      className={`group relative flex items-center justify-center ${
        isVertical ? "h-px w-full" : "h-full w-px"
      } bg-border/55 transition-colors duration-100 hover:bg-border/80 active:bg-border`}
    >
      <div
        className={`absolute z-10 cursor-grab active:cursor-grabbing ${
          HANDLE_HIT_TARGET_CLASS[direction]
        }`}
      />
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 transition-opacity duration-100 group-hover:opacity-100 group-active:opacity-100 ${
          isVertical ? "h-1 w-7" : "h-7 w-1"
        } opacity-0`}
      >
        <div
          className={`absolute inset-0 rounded-full bg-muted-foreground/30 transition-transform duration-100 group-active:scale-105`}
        />
      </div>
    </Separator>
  );
}

// ─── Recursive layout renderer ───────────────────────────────────────

const LayoutNodeRenderer = memo(function LayoutNodeRenderer({ node }: { node: LayoutNode }) {
  if (node.type === "pane") {
    return <EditorPane paneId={node.id} />;
  }

  return (
    <Group orientation={node.direction}>
      <Panel defaultSize={50} minSize={15}>
        <LayoutNodeRenderer node={node.children[0]} />
      </Panel>
      <ResizeHandle direction={node.direction} />
      <Panel defaultSize={50} minSize={15}>
        <LayoutNodeRenderer node={node.children[1]} />
      </Panel>
    </Group>
  );
});

// ─── Public component ────────────────────────────────────────────────

export function SplitContainer() {
  const root = useLayoutStore((state) => state.root);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <LayoutNodeRenderer node={root} />
    </div>
  );
}
