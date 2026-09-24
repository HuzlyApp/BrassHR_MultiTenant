"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { formatMatchModelLabel } from "@/lib/jobs/match-analysis/display";
import {
  DEFAULT_ANALYSIS_PROVIDER,
  parseAnalysisProvider,
  type AnalysisMode,
  type AnalysisProvider,
} from "@/lib/jobs/match-analysis/schema";
import { deepMatchModelForProvider } from "@/lib/jobs/match-analysis/step-config";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

export type MatchAnalyzeButtonProps = {
  analyzing?: boolean;
  isAnalyzed?: boolean;
  /** Stage 4/5: primary action is Deep Match instead of Quick Match. */
  deepPrimary?: boolean;
  /**
   * Active progression step (0=Quick … 4=Submission).
   * When set, the primary button follows this step (Verifications / Follow-up / Deep).
   */
  viewedStep?: number;
  /** Step 2 Verifications has been run at least once — show Re-run Verifications. */
  hasVerifications?: boolean;
  /** Step 3 Follow-up has been unlocked/run at least once — show Re-run Follow-up. */
  hasFollowUp?: boolean;
  hasDeepMatch?: boolean;
  disabled?: boolean;
  /** primary = AI overview header; outline = panels; compact = list cells */
  variant?: "primary" | "outline" | "compact";
  className?: string;
  buttonClassName?: string;
  /** Confirm paid Deep Match (ai.match.step3.require_recruiter_confirm). */
  requireDeepConfirm?: boolean;
  /** Hide/disable Deep Match until the recruiter has pushed a qualified candidate through. */
  allowDeep?: boolean;
  analysisProvider?: AnalysisProvider;
  deepModelLabel?: string;
  onAnalyze: (mode: AnalysisMode) => void;
};

type ModeLabels = {
  analyze: string;
  call_pack: string;
  follow_up: string;
  deep: string;
};

function modeLabels(args: {
  isAnalyzed: boolean;
  hasDeepMatch?: boolean;
  hasVerifications?: boolean;
  hasFollowUp?: boolean;
}): ModeLabels {
  return {
    analyze: args.isAnalyzed ? "Re-run Quick Match" : "Quick Match",
    call_pack: args.hasVerifications ? "Re-run Verifications" : "Run Verifications",
    follow_up: args.hasFollowUp ? "Re-run Follow-up" : "Run Follow-up",
    deep: args.hasDeepMatch ? "Re-run Deep Match" : "Run Deep Match",
  };
}

function resolvePrimaryMode(args: {
  viewedStep?: number;
  deepPrimary: boolean;
  hasVerifications: boolean;
  hasFollowUp: boolean;
}): AnalysisMode {
  const step = args.viewedStep;
  if (typeof step === "number" && Number.isFinite(step)) {
    if (step <= 0) return "analyze";
    if (step === 1) return args.hasVerifications ? "call_pack" : "analyze";
    if (step === 2) return args.hasFollowUp ? "follow_up" : args.hasVerifications ? "call_pack" : "analyze";
    return "deep";
  }
  return args.deepPrimary ? "deep" : "analyze";
}

function menuItemClassName(disabled?: boolean) {
  return `flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#334155] transition hover:bg-[#F8FAFC] ${
    disabled ? "cursor-not-allowed opacity-50" : ""
  }`;
}

function resolveDeepModelLabel(
  analysisProvider?: AnalysisProvider,
  deepModelLabel?: string
): string {
  if (deepModelLabel?.trim()) return deepModelLabel.trim();
  return formatMatchModelLabel(
    deepMatchModelForProvider(parseAnalysisProvider(analysisProvider ?? DEFAULT_ANALYSIS_PROVIDER))
  );
}

export function DeepMatchConfirmDialog({
  open,
  modelLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  modelLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const primaryColor = branding.primaryHex;
  const secondaryColor = branding.secondaryHex;

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/40 p-4"
      style={brandVars}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deep-match-confirm-title"
        className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
      >
        <h2 id="deep-match-confirm-title" className="text-lg font-semibold text-[#0F172A]">
          Run Deep Match?
        </h2>
        <p className="mt-2 text-sm text-[#64748B]">
          This uses a paid model ({modelLabel}) and writes match % and confidence. Continue?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-10 rounded-lg border-2 bg-white px-4 text-sm font-semibold transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)] disabled:opacity-60"
            style={{ borderColor: secondaryColor, color: secondaryColor }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
            style={{ backgroundColor: primaryColor, backgroundImage: "none" }}
          >
            Run Deep Match
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function FollowUpConfirmDialog({
  open,
  verifyCount,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  verifyCount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const primaryColor = branding.primaryHex;
  const secondaryColor = branding.secondaryHex;
  const itemLabel = verifyCount === 1 ? "item" : "items";

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/40 p-4"
      style={brandVars}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-up-confirm-title"
        className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
      >
        <h2 id="follow-up-confirm-title" className="text-lg font-semibold text-[#0F172A]">
          Continue to Follow-up?
        </h2>
        <p className="mt-2 text-sm text-[#64748B]">
          The Qualification Checklist still has {verifyCount} {itemLabel} that need verification.
          Generate screening questions from those notes anyway?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-10 rounded-lg border-2 bg-white px-4 text-sm font-semibold transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)] disabled:opacity-60"
            style={{ borderColor: secondaryColor, color: secondaryColor }}
          >
            Stay on checklist
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
            style={{ backgroundColor: primaryColor, backgroundImage: "none" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? "Continuing…" : "Continue to Follow-up"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type MenuEntry = {
  mode: AnalysisMode;
  label: string;
  badge?: string;
  disabled?: boolean;
};

/**
 * Quick Match / Deep Match control used across candidate list cells, row menus, and overview.
 * On the AI overview, the primary action follows the viewed progression step; the chevron
 * lists re-run options only after each step has been completed once.
 */
export function MatchAnalyzeButton({
  analyzing = false,
  isAnalyzed = false,
  deepPrimary = false,
  viewedStep,
  hasVerifications = false,
  hasFollowUp = false,
  hasDeepMatch = false,
  disabled = false,
  variant = "outline",
  className = "",
  buttonClassName = "",
  requireDeepConfirm = true,
  allowDeep = true,
  analysisProvider = DEFAULT_ANALYSIS_PROVIDER,
  deepModelLabel,
  onAnalyze,
}: MatchAnalyzeButtonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmDeep, setConfirmDeep] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const labels = modeLabels({ isAnalyzed, hasDeepMatch, hasVerifications, hasFollowUp });
  const busy = analyzing || disabled;
  const resolvedDeepLabel = resolveDeepModelLabel(analysisProvider, deepModelLabel);
  const primaryMode = resolvePrimaryMode({
    viewedStep,
    deepPrimary,
    hasVerifications,
    hasFollowUp,
  });

  const menuEntries = useMemo((): MenuEntry[] => {
    const entries: MenuEntry[] = [
      { mode: "analyze", label: labels.analyze, badge: "Standard" },
    ];
    if (hasVerifications) {
      entries.push({ mode: "call_pack", label: labels.call_pack, badge: "Step 2" });
    }
    if (hasFollowUp) {
      entries.push({ mode: "follow_up", label: labels.follow_up, badge: "Step 3" });
    }
    entries.push({
      mode: "deep",
      label: labels.deep,
      badge: "Paid",
      disabled: !allowDeep,
    });

    // Put the active-step action first in the dropdown.
    const primaryIndex = entries.findIndex((entry) => entry.mode === primaryMode);
    if (primaryIndex > 0) {
      const [primary] = entries.splice(primaryIndex, 1);
      entries.unshift(primary);
    }
    return entries;
  }, [
    allowDeep,
    hasFollowUp,
    hasVerifications,
    labels.analyze,
    labels.call_pack,
    labels.deep,
    labels.follow_up,
    primaryMode,
  ]);

  const menuHeightEstimate = Math.max(96, menuEntries.length * 40 + 16);

  const updateMenuPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, variant === "compact" ? 168 : 220);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = rect.bottom + 4;
    if (top + menuHeightEstimate > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeightEstimate - 4);
    }
    setMenuStyle({
      position: "fixed",
      top,
      left,
      width,
      visibility: "visible",
      zIndex: 220,
    });
  }, [menuHeightEstimate, variant]);

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
    if (mode === "deep" && !allowDeep) return;
    if (mode === "deep" && requireDeepConfirm) {
      setConfirmDeep(true);
      return;
    }
    onAnalyze(mode);
  }

  const icon =
    analyzing ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
    ) : isAnalyzed || hasVerifications || hasFollowUp || hasDeepMatch ? (
      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
    );

  const primaryLabel = analyzing ? "Analyzing…" : labels[primaryMode];

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
          {analyzing ? "Analyzing…" : "Quick Match"}
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
                  Quick Match
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!allowDeep}
                  className={menuItemClassName(!allowDeep)}
                  onClick={() => run("deep")}
                >
                  <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary,#0F766E)]" aria-hidden />
                  Run Deep Match
                </button>
              </div>,
              document.body
            )
          : null}
        <DeepMatchConfirmDialog
          open={confirmDeep}
          modelLabel={resolvedDeepLabel}
          busy={busy}
          onCancel={() => setConfirmDeep(false)}
          onConfirm={() => {
            setConfirmDeep(false);
            onAnalyze("deep");
          }}
        />
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
    <div
      ref={rootRef}
      className={`relative inline-flex shrink-0 items-stretch ${isPrimary ? "h-8" : ""} ${className}`}
    >
      <button
        type="button"
        disabled={busy || (primaryMode === "deep" && !allowDeep)}
        onClick={() => run(primaryMode)}
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
              {menuEntries.map((entry) => (
                <button
                  key={entry.mode}
                  type="button"
                  role="menuitem"
                  disabled={entry.disabled}
                  className={`${menuItemClassName(entry.disabled)}${
                    entry.mode === primaryMode ? " bg-[#F8FAFC] font-semibold" : ""
                  }`}
                  onClick={() => run(entry.mode)}
                >
                  {entry.label}
                  {entry.badge ? (
                    <span className="ml-auto text-[11px] text-[#94A3B8]">{entry.badge}</span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
      <DeepMatchConfirmDialog
        open={confirmDeep}
        modelLabel={resolvedDeepLabel}
        busy={busy}
        onCancel={() => setConfirmDeep(false)}
        onConfirm={() => {
          setConfirmDeep(false);
          onAnalyze("deep");
        }}
      />
    </div>
  );
}

/** Two menu items for use inside CandidateRowActionsMenu (and similar portals). */
export function MatchAnalyzeMenuItems({
  analyzing = false,
  isAnalyzed = false,
  hasDeepMatch = false,
  requireDeepConfirm = true,
  analysisProvider = DEFAULT_ANALYSIS_PROVIDER,
  deepModelLabel,
  onAnalyze,
  onClose,
}: {
  analyzing?: boolean;
  isAnalyzed?: boolean;
  hasDeepMatch?: boolean;
  requireDeepConfirm?: boolean;
  analysisProvider?: AnalysisProvider;
  deepModelLabel?: string;
  onAnalyze: (mode: AnalysisMode) => void;
  onClose?: () => void;
}): ReactNode {
  const labels = modeLabels({ isAnalyzed, hasDeepMatch });
  const resolvedDeepLabel = resolveDeepModelLabel(analysisProvider, deepModelLabel);
  function run(mode: AnalysisMode) {
    if (mode === "deep" && requireDeepConfirm) {
      const ok = window.confirm(
        `Run Deep Match? This uses a paid model (${resolvedDeepLabel}) and writes match %.`
      );
      if (!ok) return;
    }
    onAnalyze(mode);
    onClose?.();
  }
  return (
    <>
      <button
        type="button"
        role="menuitem"
        disabled={analyzing}
        onClick={() => run("analyze")}
        className={menuItemClassName(analyzing)}
      >
        {labels.analyze}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={analyzing}
        onClick={() => run("deep")}
        className={menuItemClassName(analyzing)}
      >
        {labels.deep}
      </button>
    </>
  );
}
