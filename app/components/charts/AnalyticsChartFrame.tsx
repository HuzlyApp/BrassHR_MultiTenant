"use client";

import type { ReactNode } from "react";

const CHART_INTERACTION_CLASS =
  "cursor-pointer outline-none [&_.recharts-bar-rectangle]:cursor-pointer [&_.recharts-cartesian-grid]:pointer-events-none [&_.recharts-layer]:cursor-pointer [&_.recharts-responsive-container]:outline-none [&_.recharts-surface]:cursor-pointer [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none";

type AnalyticsChartFrameProps = {
  children: ReactNode;
  className?: string;
};

export default function AnalyticsChartFrame({ children, className = "" }: AnalyticsChartFrameProps) {
  return (
    <div className={`${CHART_INTERACTION_CLASS} ${className}`.trim()} tabIndex={-1}>
      {children}
    </div>
  );
}
