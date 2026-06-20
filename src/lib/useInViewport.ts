"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether the element is currently in the viewport.
 * Unlike the old one-shot version, this updates `inView` to false
 * when the element leaves the viewport, allowing Canvases to unmount
 * and free WebGL contexts.
 */
export function useInViewport(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  // Memoize options to avoid recreating observer on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rootMargin = options?.rootMargin ?? "200px";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const threshold = options?.threshold ?? 0;

  const handleIntersection = useCallback(([entry]: IntersectionObserverEntry[]) => {
    setInView(entry.isIntersecting);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold,
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection, rootMargin, threshold]);

  return { ref, inView };
}

/**
 * Simple counter to limit simultaneous WebGL Canvases.
 * Browsers typically allow 8-16 contexts; we limit to 4.
 */
let _activeCanvases = 0;
const MAX_CANVASES = 4;

export function tryAcquireCanvasSlot(): boolean {
  if (_activeCanvases >= MAX_CANVASES) return false;
  _activeCanvases++;
  return true;
}

export function releaseCanvasSlot(): void {
  _activeCanvases = Math.max(0, _activeCanvases - 1);
}
