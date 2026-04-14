import { memo } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { useLayoutStore } from "@/store/layout";
import type { LayoutNode } from "@/shared/workspace";

import { EditorPane } from "./editor-pane";

// ─── Resize handle ───────────────────────────────────────────────────

function ResizeHandle({ direction }: { direction: "horizontal" | "vertical" }) {
  const isVertical = direction === "vertical";

  return (
    <Separator
      className={`group relative flex items-center justify-center ${
        isVertical ? "h-px" : "w-px"
      } bg-border/60 transition-colors duration-100 hover:bg-primary/40 active:bg-primary/60`}
    >
      <div
        className={`absolute z-10 ${
          isVertical ? "h-1 w-full cursor-row-resize" : "h-full w-1 cursor-col-resize"
        }`}
      />
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
    <div className="h-full min-h-0 min-w-0">
      <LayoutNodeRenderer node={root} />
    </div>
  );
}
