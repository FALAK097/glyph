import type { ReactNode } from "react";

import { Group, Panel, Separator } from "react-resizable-panels";

type AppSurfaceShellProps = {
  browserPane?: ReactNode;
  browserPaneWidth?: number;
  onBrowserPaneResize?: (width: number) => void;
  children: ReactNode;
};

function BrowserResizeHandle() {
  return (
    <Separator className="group relative flex h-full w-px touch-none select-none items-center justify-center bg-border/55 transition-colors duration-100 hover:bg-border/80 active:bg-border">
      <div className="absolute -left-1 z-10 h-full w-3 cursor-col-resize touch-none" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-active:opacity-100" />
    </Separator>
  );
}

export function AppSurfaceShell({
  browserPane,
  browserPaneWidth,
  onBrowserPaneResize,
  children,
}: AppSurfaceShellProps) {
  if (!browserPane) {
    return <div className="h-full min-h-0 min-w-0">{children}</div>;
  }

  return (
    <Group orientation="horizontal" className="h-full min-h-0 min-w-0">
      <Panel
        id="surface-browser-pane"
        defaultSize={browserPaneWidth ? `${browserPaneWidth}px` : "320px"}
        minSize="240px"
        maxSize="520px"
        groupResizeBehavior="preserve-pixel-size"
        onResize={(size) => onBrowserPaneResize?.(size.inPixels)}
      >
        <div className="h-full min-h-0 min-w-0 overflow-hidden">{browserPane}</div>
      </Panel>
      <BrowserResizeHandle />
      <Panel id="surface-main-pane" minSize="30%">
        <div className="h-full min-h-0 min-w-0 overflow-hidden">{children}</div>
      </Panel>
    </Group>
  );
}
