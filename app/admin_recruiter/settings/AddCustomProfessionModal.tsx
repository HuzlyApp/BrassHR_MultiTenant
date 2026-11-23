"use client";

import Link from "next/link";
import { Check, ExternalLink, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { ASSESSMENT_LIST_HREF } from "@/app/admin_recruiter/settings/assessment-routes";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

export type AssessmentOption = {
  id: string;
  name: string;
};

export type AddCustomProfessionFormValue = {
  name: string;
  description: string;
  assessmentIds: string[];
};

type Props = {
  open: boolean;
  industryLabel: string;
  assessments: AssessmentOption[];
  /** Assessment ids already linked / pre-selected for this position. */
  initiallySelectedAssessmentIds?: string[];
  creating?: boolean;
  onClose: () => void;
  onCreate: (value: AddCustomProfessionFormValue) => void;
};

const DESCRIPTION_MAX = 100;

const labelClassName = "text-sm font-medium text-[#64748B]";
const fieldClassName =
  "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:bg-[#F8FAFC]";

function RequiredMark() {
  return (
    <span className="text-[#EF4444]" aria-hidden>
      {" "}
      *
    </span>
  );
}

function AssessmentMultiSelect({
  options,
  values,
  onChange,
  disabled,
}: {
  options: AssessmentOption[];
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const selectedSet = new Set(values);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(values.filter((value) => value !== id));
      return;
    }
    onChange([...values, id]);
  }

  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-5 text-sm text-[#64748B]">
        No assessment categories yet. Add categories in Assessment settings, then return here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
      <ul
        id={listId}
        role="group"
        aria-label="Select assessments"
        className="max-h-56 overflow-auto py-1"
      >
        {options.map((option) => {
          const isSelected = selectedSet.has(option.id);
          return (
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={option.name}
                disabled={disabled}
                onClick={() => toggle(option.id)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[#F8FAFC] disabled:opacity-50 ${
                  isSelected
                    ? "bg-[color:color-mix(in_srgb,var(--brand-secondary)_10%,white)] font-medium text-[#0F172A]"
                    : "text-[#0F172A]"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                    isSelected
                      ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)] text-white"
                      : "border-[#CBD5E1] bg-white"
                  }`}
                  aria-hidden
                >
                  {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                {option.name}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-[#E5E7EB] px-3 py-2 text-xs text-[#64748B]">
        {values.length === 0
          ? "Select one or more assessments"
          : `${values.length} assessment${values.length === 1 ? "" : "s"} selected`}
      </div>
    </div>
  );
}

export default function AddCustomProfessionModal({
  open,
  industryLabel,
  assessments,
  initiallySelectedAssessmentIds = [],
  creating = false,
  onClose,
  onCreate,
}: Props) {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding) as CSSProperties;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentIds, setAssessmentIds] = useState<string[]>([]);

  const wasOpenRef = useRef(false);

  // Reset fields only when the dialog opens (not when assessment options refresh mid-edit).
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    setName("");
    setDescription("");
    const available = new Set(assessments.map((option) => option.id));
    setAssessmentIds(initiallySelectedAssessmentIds.filter((id) => available.has(id)));
  }, [open, industryLabel, assessments, initiallySelectedAssessmentIds]);

  // Keep selection valid when the dynamic options list updates while the dialog is open.
  useEffect(() => {
    if (!open || !wasOpenRef.current) return;
    const available = new Set(assessments.map((option) => option.id));
    setAssessmentIds((current) => {
      const kept = current.filter((id) => available.has(id));
      const next =
        kept.length > 0
          ? kept
          : initiallySelectedAssessmentIds.filter((id) => available.has(id));
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [open, assessments, initiallySelectedAssessmentIds]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const assessmentsRequired = assessments.length > 0;
  const canSubmit =
    name.trim().length > 0 &&
    !creating &&
    (!assessmentsRequired || assessmentIds.length > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      style={brandStyle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-custom-profession-title"
        aria-describedby="add-position-industry"
        className="flex max-h-[min(92dvh,720px)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-2">
          <h3 id="add-custom-profession-title" className="text-lg font-semibold text-[#0F172A]">
            Add Position
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={creating}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="relative z-10 min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          <p id="add-position-industry" className="text-xs text-[#94A3B8]">
            Add a position under <span className="font-medium text-[#64748B]">{industryLabel}.</span>
          </p>

          <label className="block space-y-1.5">
            <span className={labelClassName}>
              Position Name
              <RequiredMark />
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              disabled={creating}
              placeholder="Front-End Developer"
              aria-required
              className={fieldClassName}
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClassName}>Description (Optional)</span>
            <textarea
              value={description}
              maxLength={DESCRIPTION_MAX}
              disabled={creating}
              onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
              rows={3}
              placeholder="Describe this position…"
              className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm leading-6 text-[#0F172A] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_35%,transparent)] disabled:bg-[#F8FAFC]"
            />
            <div className="flex justify-end">
              <span className="text-xs text-[#94A3B8]">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </label>

          <div className="block space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelClassName}>
                Select Assessments
                {assessmentsRequired ? <RequiredMark /> : null}
              </span>
              <Link
                href={ASSESSMENT_LIST_HREF}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--brand-secondary)] hover:underline"
              >
                Add categories
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Categories come from Assessment settings. Already linked ones stay selected.
            </p>
            <AssessmentMultiSelect
              options={assessments}
              values={assessmentIds}
              onChange={setAssessmentIds}
              disabled={creating}
            />
          </div>
        </div>

        <div className="relative z-0 flex shrink-0 items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onCreate({
                name: name.trim(),
                description: description.trim(),
                assessmentIds,
              })
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[color:var(--brand-secondary)] px-4 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Position"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
