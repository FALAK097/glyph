import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OutlineItem } from "./../types/navigation";
export type EditorOutlineItem = OutlineItem & { pos: number };

export function TableOfContents({
  items,
  activeId,
  onJump,
}: {
  items: EditorOutlineItem[];
  activeId: string | null;
  onJump: (item: EditorOutlineItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathData, setPathData] = useState("");
  const [activeOffset, setActiveOffset] = useState(0);
  const [totalPathLength, setTotalPathLength] = useState(0);
  const [markerState, setMarkerState] = useState<{ x: number; y: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const bgPathRef = useRef<SVGPathElement>(null);

  const ACTIVE_LINE_LENGTH = 32;

  const buildPath = useCallback(() => {
    if (!containerRef.current || items.length === 0) return;

    let d = "";
    let currentX = 1;
    let currentY = 0;

    const RADIUS = 8;

    const nodes = items
      .map((item) => {
        const el = itemRefs.current.get(item.id);
        if (!el) return null;
        const x = 1 + (item.depth - 1) * 12;
        return {
          id: item.id,
          x,
          y: el.offsetTop,
          h: el.offsetHeight,
          isActive: item.id === activeId,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      x: number;
      y: number;
      h: number;
      isActive: boolean;
    }>;

    if (nodes.length === 0) return;

    let activeNode: (typeof nodes)[0] | null = null;

    nodes.forEach((node, i) => {
      if (i === 0) {
        currentX = node.x;
        currentY = node.y;
        d += `M ${currentX} ${currentY}`;
      } else {
        if (node.x === currentX) {
          d += ` L ${currentX} ${node.y}`;
          currentY = node.y;
        } else {
          const isRight = node.x > currentX;
          d += ` L ${currentX} ${node.y - RADIUS}`;

          d += ` Q ${currentX} ${node.y} ${currentX + (isRight ? RADIUS : -RADIUS)} ${node.y}`;

          d += ` L ${node.x - (isRight ? RADIUS : -RADIUS)} ${node.y}`;

          d += ` Q ${node.x} ${node.y} ${node.x} ${node.y + RADIUS}`;

          currentX = node.x;
          currentY = node.y + RADIUS;
        }
      }

      if (node.isActive) {
        activeNode = node;
      }

      d += ` L ${currentX} ${node.y + node.h}`;
      currentY = node.y + node.h;
    });

    setPathData(d);

    // Use rAF to ensure the SVG path element has rendered with the new data
    requestAnimationFrame(() => {
      const pathEl = bgPathRef.current;
      if (!pathEl) return;

      const fullLength = pathEl.getTotalLength();
      setTotalPathLength(fullLength);

      if (!activeNode) {
        setMarkerState(null);
        setActiveOffset(0);
        return;
      }

      const dotX = activeNode.x;
      const dotY = activeNode.y + activeNode.h / 2;
      setMarkerState({ x: dotX, y: dotY });

      // Binary search to find the path length that corresponds to the dot's Y position
      // along the active node's x column
      let lo = 0;
      let hi = fullLength;
      let bestLen = 0;
      let bestDist = Infinity;

      for (let iter = 0; iter < 50; iter++) {
        const mid = (lo + hi) / 2;
        const pt = pathEl.getPointAtLength(mid);

        const dist = Math.abs(pt.y - dotY) + Math.abs(pt.x - dotX) * 0.5;
        if (dist < bestDist) {
          bestDist = dist;
          bestLen = mid;
        }

        if (pt.y < dotY) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      // Also do a fine linear scan around the best point for precision
      const scanStart = Math.max(0, bestLen - 20);
      const scanEnd = Math.min(fullLength, bestLen + 20);
      for (let l = scanStart; l <= scanEnd; l += 0.5) {
        const pt = pathEl.getPointAtLength(l);
        const dist = Math.abs(pt.y - dotY) + Math.abs(pt.x - dotX) * 0.5;
        if (dist < bestDist) {
          bestDist = dist;
          bestLen = l;
        }
      }

      setActiveOffset(bestLen);
    });
  }, [items, activeId]);

  const pathKey = useMemo(() => JSON.stringify(items.map((i) => [i.id, i.line])), [items]);

  useEffect(() => {
    // Small delay to allow layout to settle
    const timeoutId = window.setTimeout(buildPath, 50);
    return () => window.clearTimeout(timeoutId);
  }, [buildPath, pathKey]);

  // The dashoffset positions the active segment so the line ends at the dot
  const dashOffset = ACTIVE_LINE_LENGTH - activeOffset;

  return (
    <div className="relative pl-[1px]" ref={containerRef}>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ minWidth: 40, zIndex: 10 }}
      >
        <path
          ref={bgPathRef}
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-border"
        />
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`text-primary transition-all duration-300 ease-out ${
            !markerState ? "opacity-0" : "opacity-100"
          }`}
          strokeDasharray={`${ACTIVE_LINE_LENGTH} ${totalPathLength + ACTIVE_LINE_LENGTH}`}
          strokeDashoffset={dashOffset}
        />
        {markerState && (
          <circle
            cx={markerState.x}
            cy={markerState.y}
            r="3"
            className="fill-primary transition-all duration-300 ease-out"
          />
        )}
      </svg>
      <div className="flex flex-col py-1 relative z-20">
        {items.map((item) => {
          const indent = (item.depth - 1) * 12;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el);
              }}
              type="button"
              className={`w-full text-left py-1.5 text-[13px] transition-colors truncate ${
                item.id === activeId
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ paddingLeft: `${indent + 16}px` }}
              onClick={() => onJump(item)}
            >
              {item.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
