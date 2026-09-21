"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ANALYSIS_PROVIDER_LABELS,
  DEFAULT_ANALYSIS_PROVIDER,
  parseAnalysisProvider,
  type AnalysisProvider,
} from "@/lib/jobs/match-analysis/schema";

const STORAGE_KEY = "brasshr.match-analysis.provider";
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2398A2B3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export function useMatchAnalysisProvider(): [
  AnalysisProvider,
  (provider: AnalysisProvider) => void,
] {
  const [provider, setProviderState] = useState<AnalysisProvider>(DEFAULT_ANALYSIS_PROVIDER);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setProviderState(parseAnalysisProvider(stored));
    } catch {
      /* ignore storage errors */
    }
  }, []);

  function setProvider(next: AnalysisProvider) {
    const parsed = parseAnalysisProvider(next);
    setProviderState(parsed);
    try {
      window.localStorage.setItem(STORAGE_KEY, parsed);
    } catch {
      /* ignore storage errors */
    }
  }

  return [provider, setProvider];
}

type MatchAnalysisModelSelectProps = {
  value: AnalysisProvider;
  onChange: (provider: AnalysisProvider) => void;
  disabled?: boolean;
  className?: string;
  /** primary matches the AI overview header height */
  variant?: "primary" | "outline";
};

export function MatchAnalysisModelSelect({
  value,
  onChange,
  disabled = false,
  className = "",
  variant = "outline",
}: MatchAnalysisModelSelectProps) {
  const heightClass = variant === "primary" ? "h-8" : "h-[2.375rem]";

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-[#64748B]">Model</span>
      <select
        value={value}
        disabled={disabled}
        aria-label="Analysis model"
        onChange={(event) => onChange(parseAnalysisProvider(event.target.value))}
        className={`${heightClass} appearance-none rounded-lg border border-[#CBD5E1] bg-white bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat py-0 pl-2.5 pr-8 text-xs font-semibold text-[#0F172A] outline-none transition hover:bg-[#F8FAFC] focus:border-[color:var(--brand-primary)] disabled:opacity-60`}
        style={{ backgroundImage: SELECT_CHEVRON }}
      >
        <option value="gemini">{ANALYSIS_PROVIDER_LABELS.gemini}</option>
        <option value="grok">{ANALYSIS_PROVIDER_LABELS.grok}</option>
      </select>
    </label>
  );
}

export function AnalyzeAllButtonGroup({
  onAnalyzeAll,
  analyzeAllLabel = "Analyze all",
  analyzeBusy = false,
  analyzeDisabled = false,
  analysisProvider,
  onAnalysisProviderChange,
  buttonClassName,
  title = "Analyze all unanalyzed candidates",
  icon,
}: {
  onAnalyzeAll: () => void;
  analyzeAllLabel?: string;
  analyzeBusy?: boolean;
  analyzeDisabled?: boolean;
  analysisProvider: AnalysisProvider;
  onAnalysisProviderChange: (provider: AnalysisProvider) => void;
  buttonClassName: string;
  title?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      <MatchAnalysisModelSelect
        variant="primary"
        value={analysisProvider}
        onChange={onAnalysisProviderChange}
        disabled={analyzeBusy}
        className="w-full justify-between sm:w-auto"
      />
      <button
        type="button"
        onClick={onAnalyzeAll}
        disabled={analyzeBusy || analyzeDisabled}
        title={title}
        className={buttonClassName}
      >
        {icon}
        {analyzeBusy ? "Analyzing…" : analyzeAllLabel}
      </button>
    </div>
  );
}
