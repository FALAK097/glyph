import { useEffect, useRef } from "react";

/**
 * Returns a ref to attach to any horizontally-scrollable container.
 *
 * Behaviour:
 * - Vertical mouse-wheel delta (deltaY) is remapped to horizontal scroll so
 *   regular mice work the same as a two-finger trackpad swipe.
 * - Native horizontal trackpad swipes (deltaX) pass through unchanged.
 * - When `disabledRef` is truthy (e.g. during a drag operation) the handler
 *   is a no-op so it doesn't interfere with drag-and-drop.
 */
export function useHorizontalScroll<T extends HTMLElement>(disabledRef?: React.RefObject<boolean>) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (disabledRef?.current) return;

      const { deltaX, deltaY } = event;

      // Native horizontal swipe from trackpad — already horizontal, just let it
      // scroll naturally without preventDefault so momentum scrolling is preserved.
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;

      // Pure vertical wheel (regular mouse) or trackpad with no horizontal
      // component: remap deltaY → horizontal scroll.
      const canScrollLeft = el.scrollLeft > 0;
      const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth;

      // Only intercept when the scroll is actually useful in this direction.
      if ((deltaY < 0 && canScrollLeft) || (deltaY > 0 && canScrollRight)) {
        event.preventDefault();
        el.scrollLeft += deltaY;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [disabledRef]);

  return ref;
}
