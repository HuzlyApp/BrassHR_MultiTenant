import type { ReactNode } from "react";

/** Avoid stale prerendered HTML for this segment (helps Turbopack/HMR hydration mismatches). */
export const dynamic = "force-dynamic";

export default function WorkersSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
