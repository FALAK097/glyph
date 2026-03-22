import { useEffect, useRef, useState } from "react";
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
  const [activeLength, setActiveLength] = useState(0);
  const [markerState, setMarkerState] = useState<{ x: number; y: number } | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;

    // Small delay to allow layout to settle
    const timeoutId = window.setTimeout(() => {
      let d = "";
      let currentX = 1;
      let currentY = 0;
      let totalLength = 0;
      let currentActiveLength = 0;

      const RADIUS = 8;
      const CURVE_LEN = (Math.PI * RADIUS) / 2;
      let foundActive = false;

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

      nodes.forEach((node, i) => {
        if (i === 0) {
          currentX = node.x;
          currentY = node.y;
          d += `M ${currentX} ${currentY}`;
        } else {
          if (node.x === currentX) {
            const dist = node.y - currentY;
            d += ` L ${currentX} ${node.y}`;
            totalLength += dist;
            currentY = node.y;
          } else {
            const isRight = node.x > currentX;
            const dist1 = (node.y - RADIUS) - currentY;
            d += ` L ${currentX} ${node.y - RADIUS}`;
            totalLength += dist1;

            d += ` Q ${currentX} ${node.y} ${currentX + (isRight ? RADIUS : -RADIUS)} ${node.y}`;
            totalLength += CURVE_LEN;

            const hDist = Math.abs(node.x - currentX) - 2 * RADIUS;
            d += ` L ${node.x - (isRight ? RADIUS : -RADIUS)} ${node.y}`;
            totalLength += hDist;

            d += ` Q ${node.x} ${node.y} ${node.x} ${node.y + RADIUS}`;
            totalLength += CURVE_LEN;

            currentX = node.x;
            currentY = node.y + RADIUS;
          }
        }

        const dotY = node.y + node.h / 2;
        if (node.isActive) {
          foundActive = true;
          currentActiveLength = totalLength + Math.max(0, dotY - currentY);
          setMarkerState({ x: currentX, y: dotY });
        }

        const dist2 = (node.y + node.h) - currentY;
        d += ` L ${currentX} ${node.y + node.h}`;
        totalLength += dist2;
        currentY = node.y + node.h;
      });

      setPathData(d);
      setActiveLength(currentActiveLength);
      if (!foundActive) setMarkerState(null);
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [items, activeId]);

  const ACTIVE_LINE_LENGTH = 32;

  return (
    <div className="relative pl-[1px]" ref={containerRef}>
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ minWidth: 40, zIndex: 10 }}
      >
        <path
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
          strokeDasharray={`${ACTIVE_LINE_LENGTH} 10000`}
          strokeDashoffset={ACTIVE_LINE_LENGTH - activeLength}
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
