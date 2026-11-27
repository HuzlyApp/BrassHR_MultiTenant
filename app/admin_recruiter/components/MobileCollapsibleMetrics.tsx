"use client";

import {
  Children,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type MobileCollapsibleMetricsProps = {
  children: ReactNode;
  /** Grid/layout classes for the metrics row (desktop unchanged). */
  className?: string;
  /** Optional aria label for the region. */
  "aria-label"?: string;
};

/**
 * Mobile (&lt; sm): show the first metric card only; "View more" reveals the rest.
 * `sm+`: always show every card (toggle is hidden).
 */
export function MobileCollapsibleMetrics({
  children,
  className,
  "aria-label": ariaLabel = "Summary metrics",
}: MobileCollapsibleMetricsProps) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children).filter(Boolean) as ReactElement[];
  const canCollapse = items.length > 1;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3" aria-label={ariaLabel}>
      <div className={className}>
        {items.map((child, index) => (
          <div
            key={child.key ?? index}
            className={
              index === 0 || expanded || !canCollapse
                ? "min-w-0"
                : "min-w-0 max-sm:hidden"
            }
          >
            {child}
          </div>
        ))}
      </div>

      {canCollapse ? (
        <div className="flex justify-end sm:hidden">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-primary)] transition hover:brightness-95"
            aria-expanded={expanded}
          >
            {expanded ? "View less" : "View more"}
            {expanded ? (
              <ChevronUp className="size-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
