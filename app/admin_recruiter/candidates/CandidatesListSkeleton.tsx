"use client";

type Props = {
  rows?: number;
  view?: "list" | "card";
};

/** Non-blocking placeholder while a candidates page request is in flight. */
export function CandidatesListSkeleton({ rows = 8, view = "list" }: Props) {
  if (view === "card") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading candidates">
        {Array.from({ length: Math.min(rows, 6) }, (_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-[#F8FAFC] to-[#EEF2F7]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[#E5E7EB]" aria-busy="true" aria-label="Loading candidates">
      <div className="h-11 bg-brand-lite" />
      <div className="divide-y divide-[#E9EDF3]">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#E2E8F0]" />
            <div className="h-4 w-36 animate-pulse rounded bg-[#E2E8F0]" />
            <div className="hidden h-4 w-28 animate-pulse rounded bg-[#E2E8F0] sm:block" />
            <div className="ml-auto hidden h-4 w-20 animate-pulse rounded bg-[#E2E8F0] md:block" />
            <div className="hidden h-4 w-16 animate-pulse rounded bg-[#E2E8F0] lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
