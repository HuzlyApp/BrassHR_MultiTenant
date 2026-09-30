"use client";

import { useEffect, useState } from "react";
import { EASTERN_TIME_LABEL, EASTERN_TIME_ZONE, formatEastern } from "@/lib/datetime/eastern";

type EasternLiveClockProps = {
  className?: string;
  /** Compact chip vs inline text. */
  variant?: "chip" | "inline";
};

function formatLiveEastern(now: Date): string {
  return formatEastern(now, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Live Eastern Time clock with updating seconds. */
export default function EasternLiveClock({
  className = "",
  variant = "chip",
}: EasternLiveClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const label = now ? formatLiveEastern(now) : "—";

  if (variant === "inline") {
    return (
      <span className={className} title={`${EASTERN_TIME_LABEL} (${EASTERN_TIME_ZONE})`}>
        {label} {EASTERN_TIME_LABEL}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-col rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm ${className}`}
      title={`${EASTERN_TIME_LABEL} (${EASTERN_TIME_ZONE})`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Current {EASTERN_TIME_LABEL}
      </span>
      <span className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
        {label}
      </span>
    </div>
  );
}
