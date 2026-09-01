"use client";

type CandidateBulkSelectionBarProps = {
  selectedCount: number;
  eligibleCount: number;
  scopeLabel?: string;
  claimBusy?: boolean;
  analyzeBusy?: boolean;
  analyzeLabel?: string;
  hideClaim?: boolean;
  onClaim?: () => void;
  onAnalyze?: () => void;
  onClear: () => void;
};

export function CandidateBulkSelectionBar({
  selectedCount,
  eligibleCount,
  scopeLabel,
  claimBusy = false,
  analyzeBusy = false,
  analyzeLabel = "Analyze",
  hideClaim = false,
  onClaim,
  onAnalyze,
  onClear,
}: CandidateBulkSelectionBarProps) {
  if (selectedCount <= 0) return null;

  const selectedLabel =
    selectedCount === 1 ? "1 candidate selected" : `${selectedCount} candidates selected`;
  const claimLabel = eligibleCount === 1 ? "Claim Candidate" : "Claim Candidates";
  const busy = claimBusy || analyzeBusy;

  return (
    <div
      className="sticky top-0 z-20 flex flex-col gap-2 border-b border-[#E5E7EB] bg-[#F0FDFA] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0F766E]">{selectedLabel}</p>
        {scopeLabel ? <p className="text-xs text-[#64748B]">{scopeLabel}</p> : null}
        {!hideClaim && eligibleCount < selectedCount ? (
          <p className="text-xs text-[#B45309]">
            {eligibleCount} eligible to claim · {selectedCount - eligibleCount} will be skipped
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear Selection
        </button>
        {onAnalyze ? (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={busy || selectedCount === 0}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#475569] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzeBusy ? "Analyzing…" : analyzeLabel}
          </button>
        ) : null}
        {!hideClaim && onClaim ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={busy || eligibleCount === 0}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {claimBusy ? "Claiming…" : claimLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
