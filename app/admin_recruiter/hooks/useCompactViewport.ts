"use client";

import { useEffect, useState } from "react";

/** Mobile + tablet: below Tailwind `lg` (1024px). Desktop keeps existing inline edit UI. */
const COMPACT_MAX_WIDTH_PX = 1023;

function readCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH_PX}px)`).matches;
}

export function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(readCompactViewport);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH_PX}px)`);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return compact;
}
