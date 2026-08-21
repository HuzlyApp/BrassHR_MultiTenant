"use client";

import type { CSSProperties, ReactNode } from "react";
import { Check } from "lucide-react";
import {
  APPLICANT_ACTION_ROW,
  APPLICANT_BTN_BACK,
  APPLICANT_BTN_PRIMARY,
  APPLICANT_HEADER_ROW,
  APPLICANT_TITLE_CLASS,
} from "@/app/application/applicant-onboarding-responsive";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  brandingShellGradient,
  brandingToCssVars,
  hexToRgba,
} from "@/lib/tenant/tenant-branding";
import { formatApplicantStepperLabel } from "@/lib/onboarding/format-applicant-stepper-label";
import type { StepPreviewModel, StepPreviewState } from "@/lib/onboarding/step-preview-model";

export function PreviewInert({ children }: { children: ReactNode }) {
  return (
    <div
      role="presentation"
      onSubmit={(event) => event.preventDefault()}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("a")) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}

export function PreviewField({
  label,
  value,
  placeholder,
  required,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  type?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-gray-600">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        readOnly
        tabIndex={-1}
        value={value}
        placeholder={placeholder}
        className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-[#1e293b] outline-none ${
          error
            ? "border-red-400 ring-2 ring-red-100"
            : "border-gray-200"
        }`}
      />
      {error ? <span className="mt-1 block text-[11px] text-red-600">This field is required.</span> : null}
    </label>
  );
}

export function PreviewTextarea({
  label,
  value,
  placeholder,
  required,
  error,
  rows = 4,
}: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  rows?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-gray-600">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <textarea
        readOnly
        tabIndex={-1}
        rows={rows}
        value={value}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-[#1e293b] outline-none ${
          error ? "border-red-400 ring-2 ring-red-100" : "border-gray-200"
        }`}
      />
    </label>
  );
}

export function PreviewActionRow({
  backLabel = "Back",
  primaryLabel,
}: {
  backLabel?: string;
  primaryLabel: string;
}) {
  return (
    <div className={APPLICANT_ACTION_ROW}>
      <button type="button" tabIndex={-1} className={APPLICANT_BTN_BACK}>
        {backLabel}
      </button>
      <button type="button" tabIndex={-1} className={APPLICANT_BTN_PRIMARY}>
        {primaryLabel}
      </button>
    </div>
  );
}

export function PreviewStatusBanner({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "danger" | "warning";
  children: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-700";
  return <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</p>;
}

function PreviewStepIcon({ current, completed }: { current: boolean; completed: boolean }) {
  if (completed) return <Check size={14} strokeWidth={3} />;
  if (current) {
    return <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-primary)]" />;
  }
  return <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />;
}

export function PreviewStepper({ model, previewState }: { model: StepPreviewModel; previewState: StepPreviewState }) {
  const branding = useTenantBranding();
  const currentIndex = Math.max(
    0,
    model.stepperSteps.findIndex((step) => step.current)
  );
  const completedThrough =
    previewState === "completed" || previewState === "approved" ? currentIndex + 1 : currentIndex;

  return (
    <div
      className="min-w-0 w-full border-b border-slate-200 pb-4"
      style={brandingToCssVars(branding)}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {model.progressLabel}
          </p>
          <h1 className="text-lg font-semibold text-slate-800">{model.header}</h1>
        </div>
        <p className="text-sm font-medium text-slate-600">
          {Math.min(completedThrough, model.stepperSteps.length)} / {model.stepperSteps.length}
        </p>
      </div>
      <div className="flex w-full overflow-x-auto">
        {model.stepperSteps.map((step, index) => {
          const completed = index < completedThrough;
          const current = index === currentIndex;
          return (
            <div key={step.id} className="relative flex min-w-[4.5rem] flex-1 flex-col items-center">
              {index < model.stepperSteps.length - 1 ? (
                <div
                  className="pointer-events-none absolute top-[13px] left-1/2 z-0 h-[2px] w-full bg-[#f1f5f9]"
                  aria-hidden
                >
                  <div
                    className="h-full bg-[color:var(--brand-primary)]"
                    style={{ width: completed ? "100%" : "0%" }}
                  />
                </div>
              ) : null}
              <div
                className={`relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm font-semibold ${
                  completed
                    ? "bg-[color:var(--brand-primary)] text-white"
                    : current
                      ? "border-[3px] border-[color:var(--brand-primary)] bg-white"
                      : "border-[3px] border-[#f1f5f9] bg-white text-[#e2e8f0]"
                }`}
              >
                <PreviewStepIcon current={current} completed={completed} />
              </div>
              <span
                className={`mt-2 whitespace-pre-line text-center text-[10px] leading-tight ${
                  completed || current
                    ? "font-medium text-[color:var(--brand-primary)]"
                    : "text-gray-400"
                }`}
              >
                {formatApplicantStepperLabel(step.title)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PreviewPageHeader({
  title,
  description,
  extra,
}: {
  title: string;
  description?: string | null;
  extra?: ReactNode;
}) {
  return (
    <div className="pt-5">
      <div className={APPLICANT_HEADER_ROW}>
        <h2 className={APPLICANT_TITLE_CLASS}>{title}</h2>
      </div>
      {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      {extra}
    </div>
  );
}

export function PreviewOnboardingCard({
  model,
  previewState,
  viewport,
  children,
}: {
  model: StepPreviewModel;
  previewState: StepPreviewState;
  viewport: "panel" | "mobile" | "desktop";
  children: ReactNode;
}) {
  const branding = useTenantBranding();
  const shellStyle: CSSProperties = {
    ...brandingToCssVars(branding),
    background: brandingShellGradient(branding),
  };
  const showBrandPanel = viewport === "desktop";

  return (
    <div className="h-full w-full p-2 sm:p-3" style={shellStyle}>
      <div
        className={`mx-auto flex h-full min-h-0 overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] ${
          showBrandPanel ? "max-w-[1060px] grid-cols-[minmax(0,2.2fr)_minmax(180px,1fr)] min-[700px]:grid" : "max-w-[420px]"
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto px-4 py-5 sm:px-5">
          {model.isApplicantFacing || CANDIDATE_KINDS_SAFE.has(model.kind) ? (
            <PreviewStepper model={model} previewState={previewState} />
          ) : null}
          {children}
        </div>
        {showBrandPanel ? (
          <div
            className="relative hidden min-h-0 overflow-hidden min-[700px]:block"
            style={{ backgroundColor: hexToRgba(branding.primaryHex, 0.08) }}
          >
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-800">{branding.companyName}</p>
                <p className="mt-2 text-xs text-slate-600">{branding.tagline}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CANDIDATE_KINDS_SAFE = new Set([
  "resume_upload",
  "profile_form",
  "job_application",
  "offer_acceptance",
  "agreement",
  "document_upload",
  "references",
  "skills_intro",
  "custom_question",
  "summary",
]);

export function filled(previewState: StepPreviewState): boolean {
  return (
    previewState === "filled" ||
    previewState === "completed" ||
    previewState === "approved" ||
    previewState === "rejected"
  );
}

export function showError(previewState: StepPreviewState): boolean {
  return previewState === "error";
}
