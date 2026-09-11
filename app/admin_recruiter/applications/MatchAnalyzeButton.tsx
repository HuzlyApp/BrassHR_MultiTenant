"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { AnalysisMode } from "@/lib/jobs/match-analysis/schema";

export type MatchAnalyzeButtonProps = {
  analyzing?: boolean;
  isAnalyzed?: boolean;
  disabled?: boolean;
  /** primary = AI overview header; outline = panels; compact = list cells */
  variant?: "primary" | "outline" | "compact";
  className?: string;
  buttonClassName?: string;
  onAnalyze: (mode: AnalysisMode) => void;
};

function modeLabels(isAnalyzed: boolean) {
  return {
    analyze: isAnalyzed ? "Reanalyze" : "Analyze",
    deep: isAnalyzed ? "Deeper Reanalyze" : "Deeper Analyze",
  } as const;
}

function menuItemClassName(disabled?: boolean) {
  return `flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#334155] transition hover:bg-[#F8FAFC] ${
    disabled ? "opacity-50" : ""
  }`;
}

/**
 * Analyze / Deeper Analyze control used across candidate list cells, row menus, and overview.
 * Main action runs standard Analyze; chevron (or compact tap) offers Deeper Analyze.
 */
export function MatchAnalyzeButton({
  analyzing = false,
  isAnalyzed = false,
  disabled = false,
  variant = "outline",
  className = "",
  buttonClassName = "",
  onAnalyze,
}: MatchAnalyzeButtonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const labels = modeLabels(isAnalyzed);
  const busy = analyzing || disabled;

  const updateMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, variant === "compact" ? 168 : 200);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = rect.bottom + 4;
    if (top + 96 > window.innerHeight - 8) {
      top = Math.max(8, rect.top - 96 - 4);
    }
    setMenuStyle({
      position: "fixed",
      top,
      left,
      width,
      visibility: "visible",
      zIndex: 220,
    });
  }, [variant]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateMenuPosition();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, updateMenuPosition]);

  function run(mode: AnalysisMode) {
    setOpen(false);
    onAnalyze(mode);
  }

  const icon =
    analyzing ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    ) : isAnalyzed ? (
      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
    );

  const primaryLabel =
    analyzing
      ? "Analyzing…"
      : variant === "primary"
        ? isAnalyzed
          ? "Reanalyze"
          : "Analyze candidate"
        : labels.analyze;

  if (variant === "compact") {
    return (
      <div ref={rootRef} className={`relative inline-flex ${className}`}>
        <button
          type="button"
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-60 ${buttonClassName}`}
        >
          {analyzing ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden />
          )}
          {analyzing ? "Analyzing…" : "Analyze"}
          {!analyzing ? <ChevronDown className="h-3 w-3 opacity-70" aria-hidden /> : null}
        </button>
        {open && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                role="menu"
                aria-label="Match analysis options"
                style={menuStyle}
                className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName()}
                  onClick={() => run("analyze")}
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#64748B]" aria-hidden />
                  Analyze
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClassName()}
                  onClick={() => run("deep")}
                >
                  <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary,#0F766E)]" aria-hidden />
                  Deeper Analyze
                </button>
              </div>,
              document.body
            )
          : null}
      </div>
    );
  }

  const isPrimary = variant === "primary";
  const mainClass = isPrimary
    ? `inline-flex h-8 items-center gap-1.5 rounded-l-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold leading-4 text-white transition hover:brightness-95 disabled:opacity-60 ${buttonClassName}`
    : `inline-flex items-center gap-1.5 rounded-l-lg border border-[#CBD5E1] border-r-0 bg-white px-3 py-1.5 text-sm font-medium text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-60 ${buttonClassName}`;
  const chevronClass = isPrimary
    ? "inline-flex h-8 items-center justify-center rounded-r-lg border-l border-white/25 bg-[color:var(--brand-primary)] px-2 text-white transition hover:brightness-95 disabled:opacity-60"
    : "inline-flex items-center justify-center rounded-r-lg border border-[#CBD5E1] bg-white px-2 py-1.5 text-[#0F172A] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-60";

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => run("analyze")}
        className={mainClass}
      >
        {icon}
        {primaryLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More analysis options"
        onClick={() => setOpen((value) => !value)}
        className={chevronClass}
      >
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Match analysis options"
              style={menuStyle}
              className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName()}
                onClick={() => run("analyze")}
              >
                {labels.analyze}
                <span className="ml-auto text-[11px] text-[#94A3B8]">Standard</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItemClassName()}
                onClick={() => run("deep")}
              >
                {labels.deep}
                <span className="ml-auto text-[11px] text-[#94A3B8]">Full</span>
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/** Two menu items for use inside CandidateRowActionsMenu (and similar portals). */
export function MatchAnalyzeMenuItems({
  analyzing = false,
  isAnalyzed = false,
  onAnalyze,
  onClose,
}: {
  analyzing?: boolean;
  isAnalyzed?: boolean;
  onAnalyze: (mode: AnalysisMode) => void;
  onClose?: () => void;
}): ReactNode {
  const labels = modeLabels(isAnalyzed);
  return (
    <>
      <button
        type="button"
        role="menuitem"
        disabled={analyzing}
        onClick={() => {
          onAnalyze("analyze");
          onClose?.();
        }}
        className={menuItemClassName(analyzing)}
      >
        {labels.analyze}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={analyzing}
        onClick={() => {
          onAnalyze("deep");
          onClose?.();
        }}
        className={menuItemClassName(analyzing)}
      >
        {labels.deep}
      </button>
    </>
  );
}
