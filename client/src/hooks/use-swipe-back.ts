import { useEffect, useRef, useCallback } from "react";

const EDGE_THRESHOLD = 50;
const SWIPE_MIN_DISTANCE = 80;
const SWIPE_MAX_Y = 100;

function isScrollableElement(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node) {
    const tag = node.tagName?.toLowerCase();
    if (tag === "textarea" || tag === "input" || tag === "pre" || tag === "code") return true;
    if (node.scrollWidth > node.clientWidth) {
      const style = window.getComputedStyle(node);
      const overflowX = style.overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    if (node.getAttribute?.("data-no-swipe-back") === "true") return true;
    node = node.parentElement;
  }
  return false;
}

export function useSwipeBack(onBack: (() => void) | undefined) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const ensureIndicator = useCallback(() => {
    if (indicatorRef.current) return indicatorRef.current;
    const el = document.createElement("div");
    el.setAttribute("data-testid", "swipe-back-indicator");
    el.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 16px;
      height: 100%;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      background: linear-gradient(to right, hsl(var(--foreground) / 0.08), transparent);
      transition: opacity 0.15s ease;
    `;
    document.body.appendChild(el);
    indicatorRef.current = el;
    return el;
  }, []);

  useEffect(() => {
    if (!onBack) return;

    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (!isStandalone) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX > EDGE_THRESHOLD) return;
      if (isScrollableElement(e.target)) return;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      trackingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = Math.abs(touch.clientY - startYRef.current);

      if (dy > SWIPE_MAX_Y) {
        trackingRef.current = false;
        const ind = indicatorRef.current;
        if (ind) ind.style.opacity = "0";
        return;
      }

      if (dx > 10) {
        const progress = Math.min(dx / SWIPE_MIN_DISTANCE, 1);
        const ind = ensureIndicator();
        ind.style.opacity = String(progress);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      trackingRef.current = false;

      const ind = indicatorRef.current;
      if (ind) ind.style.opacity = "0";

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startXRef.current;
      const dy = Math.abs(touch.clientY - startYRef.current);

      if (dx >= SWIPE_MIN_DISTANCE && dy < SWIPE_MAX_Y) {
        onBack();
      }
    };

    const handleTouchCancel = () => {
      trackingRef.current = false;
      const ind = indicatorRef.current;
      if (ind) ind.style.opacity = "0";
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
      if (indicatorRef.current) {
        indicatorRef.current.remove();
        indicatorRef.current = null;
      }
    };
  }, [onBack, ensureIndicator]);
}
