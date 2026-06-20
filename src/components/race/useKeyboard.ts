"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Tracks currently pressed keys via a Set.
 * Returns a ref whose .current is the Set of pressed key strings.
 */
export function useKeyboard(): React.MutableRefObject<Set<string>> {
  const keys = useRef<Set<string>>(new Set());

  const down = useCallback((e: KeyboardEvent) => {
    // Prevent browser scrolling for game keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    keys.current.add(e.key);
  }, []);

  const up = useCallback((e: KeyboardEvent) => {
    keys.current.delete(e.key);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [down, up]);

  return keys;
}
