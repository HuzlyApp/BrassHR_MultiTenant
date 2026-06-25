"use client";

import { useEffect, useState } from "react";

/** Filters open on desktop by default; collapsed on mobile so candidates show first. */
export function useCandidatesFilterRowsDefault() {
  const [showFilterRows, setShowFilterRows] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setShowFilterRows(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return [showFilterRows, setShowFilterRows] as const;
}
