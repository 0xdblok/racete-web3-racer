"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether the element is currently in the viewport.
 */
export function useInViewport(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  const rootMargin = options?.rootMargin ?? "200px";
  const threshold = options?.threshold ?? 0;

  const handleIntersection = useCallback(([entry]: IntersectionObserverEntry[]) => {
    setInView(entry.isIntersecting);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersection, { rootMargin, threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection, rootMargin, threshold]);

  return { ref, inView };
}

/* ------------------------------------------------------------------ */
/*  WebGL Slot Pool with Queue (increased to 6 for static previews)    */
/* ------------------------------------------------------------------ */

const MAX_CANVASES = 6;

type SlotListener = () => void;

let _activeCanvases = 0;
const _waitQueue: SlotListener[] = [];

export function tryAcquireCanvasSlot(): boolean {
  if (_activeCanvases >= MAX_CANVASES) return false;
  _activeCanvases++;
  return true;
}

export function releaseCanvasSlot(): void {
  if (_activeCanvases <= 0) return;
  _activeCanvases--;
  // Notify next waiter
  const next = _waitQueue.shift();
  if (next) {
    // Defer to avoid cascading setState in effects
    setTimeout(next, 0);
  }
}

/** Register a callback to be called when a slot becomes available */
export function waitForCanvasSlot(cb: SlotListener): () => void {
  _waitQueue.push(cb);
  return () => {
    const idx = _waitQueue.indexOf(cb);
    if (idx >= 0) _waitQueue.splice(idx, 1);
  };
}

/** Current active canvas count (for debugging) */
export function getActiveCanvasCount(): number {
  return _activeCanvases;
}
