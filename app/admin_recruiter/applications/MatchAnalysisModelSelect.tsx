"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ANALYSIS_PROVIDER_LABELS,
  DEFAULT_ANALYSIS_PROVIDER,
  isAnalysisProvider,
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
      if (stored && isAnalysisProvider(stored)) setProviderState(stored);
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

function useClaudeProviderAvailable(explicit?: boolean): boolean {
  const [available, setAvailable] = useState(Boolean(explicit));

  useEffect(() => {
    if (explicit != null) {
      setAvailable(explicit);
      return;
    }
    let cancelled = false;
    void fetch("/api/admin/match-analysis/providers")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as {
          providers?: { claude?: boolean };
        } | null;
        if (!cancelled && body?.providers?.claude) setAvailable(true);
      })
      .catch(() => {
        /* keep hidden when availability cannot be confirmed */
      });
    return () => {
      cancelled = true;
    };
  }, [explicit]);

  return available;
}

type MatchAnalysisModelSelectProps = {
  value: AnalysisProvider;
  onChange: (provider: AnalysisProvider) => void;
  disabled?: boolean;
  className?: string;
  /** primary matches the AI overview header height */
  variant?: "primary" | "outline";
  /** When known from a server prop; otherwise fetched once from the providers endpoint. */
  claudeAvailable?: boolean;
};

export function MatchAnalysisModelSelect({
  value,
  onChange,
  disabled = false,
  className = "",
  variant = "outline",
  claudeAvailable: claudeAvailableProp,
}: MatchAnalysisModelSelectProps) {
  const heightClass = variant === "primary" ? "h-8" : "h-[2.375rem]";
  const claudeAvailable = useClaudeProviderAvailable(claudeAvailableProp);

  useEffect(() => {
    if (!claudeAvailable && value === "claude") {
      onChange(DEFAULT_ANALYSIS_PROVIDER);
    }
  }, [claudeAvailable, value, onChange]);

  return (
    <label className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap ${className}`}>
      <span className="text-xs font-medium text-[#64748B]">Model</span>
      <select
        value={value}
        disabled={disabled}
        aria-label="Analysis model"
        onChange={(event) => onChange(parseAnalysisProvider(event.target.value))}
        className={`${heightClass} appearance-none rounded-lg border border-[#CBD5E1] bg-white bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat py-0 pl-2.5 pr-8 text-xs font-semibold text-[#0F172A] outline-none transition hover:bg-[#F8FAFC] focus:border-[color:var(--brand-primary)] disabled:opacity-60`}
        style={{ backgroundImage: SELECT_CHEVRON }}
      >
        <option value="grok">{ANALYSIS_PROVIDER_LABELS.grok}</option>
        <option value="gemini">{ANALYSIS_PROVIDER_LABELS.gemini}</option>
        {claudeAvailable ? (
          <option value="claude">{ANALYSIS_PROVIDER_LABELS.claude}</option>
        ) : null}
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
  claudeAvailable,
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
  claudeAvailable?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      <MatchAnalysisModelSelect
        variant="primary"
        value={analysisProvider}
        onChange={onAnalysisProviderChange}
        disabled={analyzeBusy}
        className="w-full justify-between sm:w-auto"
        claudeAvailable={claudeAvailable}
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
