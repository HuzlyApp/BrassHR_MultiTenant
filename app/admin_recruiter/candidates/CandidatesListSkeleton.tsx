"use client";

type Props = {
  rows?: number;
  view?: "list" | "card";
  /** Accessible label for the loading region. */
  label?: string;
  /** Extra classes for the card-grid container (e.g. jobs 4-column layout). */
  cardGridClassName?: string;
  /** Extra classes for each card placeholder. */
  cardClassName?: string;
};

/** Non-blocking list/card placeholder while a listing request is in flight. */
export function CandidatesListSkeleton({
  rows = 8,
  view = "list",
  label = "Loading",
  cardGridClassName = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  cardClassName = "h-40 animate-pulse rounded-xl border border-[#E5E7EB] bg-gradient-to-br from-[#F8FAFC] to-[#EEF2F7]",
}: Props) {
  if (view === "card") {
    return (
      <div className={cardGridClassName} aria-busy="true" aria-label={label}>
        {Array.from({ length: Math.min(rows, 8) }, (_, i) => (
          <div key={i} className={cardClassName} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-[#E5E7EB]"
      aria-busy="true"
      aria-label={label}
    >
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
