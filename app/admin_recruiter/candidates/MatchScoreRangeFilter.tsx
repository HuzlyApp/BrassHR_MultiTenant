"use client";

import {
  CANDIDATE_MATCH_SCORE_RANGE_OPTIONS,
  encodeCustomMatchScoreRange,
  isCustomMatchScoreFilter,
  parseCustomMatchScoreRange,
} from "@/lib/admin/candidate-match-score-filter";

const SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

export function MatchScoreRangeFilter({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const custom = isCustomMatchScoreFilter(value);
  const customRange = parseCustomMatchScoreRange(value);
  const selectValue = custom ? "custom" : value;
  const selectClass = compact
    ? "absolute inset-0 cursor-pointer opacity-0"
    : "rounded-lg border border-[#CBD5E1] bg-white h-10 w-full min-w-0 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0";

  const inputClass = compact
    ? "h-8 w-[68px] rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs text-[#334155] outline-none focus:border-[color:var(--brand-primary)]"
    : "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] outline-none focus:border-[color:var(--brand-primary)]";

  function handleSelect(next: string) {
    if (next === "custom") {
      onChange(encodeCustomMatchScoreRange(customRange.min, customRange.max));
      return;
    }
    onChange(next);
  }

  function handleCustomBound(bound: "min" | "max", next: string) {
    const min = bound === "min" ? next : customRange.min;
    const max = bound === "max" ? next : customRange.max;
    onChange(encodeCustomMatchScoreRange(min, max));
  }

  const select = (
    <select
      aria-label="Match score"
      value={selectValue}
      onChange={(event) => handleSelect(event.target.value)}
      className={selectClass}
      style={compact ? undefined : SELECT_CHEVRON}
    >
      <option value="">Match score</option>
      {CANDIDATE_MATCH_SCORE_RANGE_OPTIONS.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
      <option value="custom">Custom range</option>
    </select>
  );

  const customInputs = custom ? (
    <div className={`flex items-center gap-1.5 ${compact ? "" : "mt-1.5"}`}>
      <input
        type="number"
        min={0}
        max={100}
        inputMode="numeric"
        placeholder="Min"
        aria-label="Match score minimum"
        value={customRange.min}
        onChange={(event) => handleCustomBound("min", event.target.value)}
        className={inputClass}
      />
      <span className="text-xs text-[#94A3B8]">to</span>
      <input
        type="number"
        min={0}
        max={100}
        inputMode="numeric"
        placeholder="Max"
        aria-label="Match score maximum"
        value={customRange.max}
        onChange={(event) => handleCustomBound("max", event.target.value)}
        className={inputClass}
      />
      {compact ? <span className="text-xs text-[#94A3B8]">%</span> : null}
    </div>
  ) : null;

  if (compact) {
    const display =
      CANDIDATE_MATCH_SCORE_RANGE_OPTIONS.find((option) => option.id === value)?.label ??
      (custom ? "Custom range" : "Match score");
    return (
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative inline-flex h-8 w-[150px] shrink-0 items-center overflow-hidden rounded-lg border border-[#CBD5E1] bg-white pl-3.5 pr-2">
          <span className="min-w-0 flex-1 truncate text-xs font-normal leading-4 text-[#374151]">
            {display}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
            <path
              d="M4 6.5L8 10.5L12 6.5"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {select}
        </div>
        {customInputs}
      </div>
    );
  }

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-[#475569]">Match Score</span>
      {select}
      {customInputs}
    </label>
  );
}
