import { useEffect, useRef, type RefObject } from "react";

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
type BooleanRef = RefObject<boolean> | { current: boolean };

export function useHorizontalScroll<T extends HTMLElement>(
  disabledRef?: BooleanRef,
  refreshKey?: unknown,
) {
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

      // Check if there is any element between event.target and el that can scroll vertically.
      // If so, let that element handle the vertical scroll instead of translating it to horizontal.
      let target = event.target as Node | null;
      while (target && target !== el) {
        if (target instanceof HTMLElement) {
          const style = window.getComputedStyle(target);
          const isScrollableY = style.overflowY === "auto" || style.overflowY === "scroll";
          const hasScrollableContent = target.scrollHeight > target.clientHeight;
          if (isScrollableY && hasScrollableContent) {
            const canScrollDown = target.scrollTop + target.clientHeight < target.scrollHeight - 1;
            const canScrollUp = target.scrollTop > 0;
            if ((deltaY > 0 && canScrollDown) || (deltaY < 0 && canScrollUp)) {
              return;
            }
          }
        }
        target = target.parentNode;
      }

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
  }, [disabledRef, refreshKey]);

  return ref;
}
