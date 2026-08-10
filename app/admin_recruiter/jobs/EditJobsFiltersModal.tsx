"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { CANDIDATES_PAGE_SUBTITLE_STYLE } from "@/app/admin_recruiter/candidates/candidates-typography";
import type { JobListRow } from "./render-job-list-cell";

export type JobsExtendedFilterValues = {
  profession: string;
  status: string;
  /** Employment Type (shift_type / job type chips). */
  employmentType: string;
  location: string;
  /** Placement type (Remote / Hybrid / On-site). */
  placementType: string;
  specialty: string;
  contractGroup: string;
  /** W2 / 1099. */
  w2Type: string;
  sourceType: string;
  workflow: string;
  /** Pay rate band id (see JOB_PAY_RATE_FILTER_OPTIONS). */
  payRate: string;
  /** Date posted preset id (see JOB_DATE_POSTED_FILTER_OPTIONS). */
  datePosted: string;
};

export const EMPTY_JOBS_EXTENDED_FILTERS: JobsExtendedFilterValues = {
  profession: "",
  status: "",
  employmentType: "",
  location: "",
  placementType: "",
  specialty: "",
  contractGroup: "",
  w2Type: "",
  sourceType: "",
  workflow: "",
  payRate: "",
  datePosted: "",
};

/** Fixed pay-rate bands shown in More Filters (min inclusive, max exclusive; last band open-ended). */
export const JOB_PAY_RATE_FILTER_OPTIONS = [
  { id: "under_25", label: "Under $25", min: 0, max: 25 },
  { id: "25_40", label: "$25 – $40", min: 25, max: 40 },
  { id: "40_60", label: "$40 – $60", min: 40, max: 60 },
  { id: "60_80", label: "$60 – $80", min: 60, max: 80 },
  { id: "80_100", label: "$80 – $100", min: 80, max: 100 },
  { id: "100_plus", label: "$100+", min: 100, max: Number.POSITIVE_INFINITY },
] as const;

export type JobPayRateFilterId = (typeof JOB_PAY_RATE_FILTER_OPTIONS)[number]["id"];

export const JOB_DATE_POSTED_FILTER_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_14", label: "Last 14 days" },
  { id: "last_30", label: "Last 30 days" },
  { id: "last_90", label: "Last 90 days" },
  { id: "older_90", label: "Older than 90 days" },
] as const;

export type JobDatePostedFilterId = (typeof JOB_DATE_POSTED_FILTER_OPTIONS)[number]["id"];

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Inclusive pay bounds for a job (suggested rate, or min/max range). */
export function jobPayRateBounds(job: JobListRow): { min: number; max: number } | null {
  const suggested = toNumberOrNull(job.pay_rate);
  const min = toNumberOrNull(job.pay_rate_min);
  const max = toNumberOrNull(job.pay_rate_max);
  if (suggested != null) return { min: suggested, max: suggested };
  if (min != null && max != null) return { min: Math.min(min, max), max: Math.max(min, max) };
  if (min != null) return { min, max: min };
  if (max != null) return { min: max, max };
  return null;
}

/** True when the job's pay rate overlaps the selected band. */
export function jobMatchesPayRateFilter(job: JobListRow, payRateFilter: string): boolean {
  if (!payRateFilter) return true;
  const option = JOB_PAY_RATE_FILTER_OPTIONS.find((row) => row.id === payRateFilter);
  if (!option) return true;
  const bounds = jobPayRateBounds(job);
  if (!bounds) return false;
  return bounds.max >= option.min && bounds.min < option.max;
}

function jobPostedAt(job: JobListRow): Date | null {
  const raw = job.published_at || job.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgoFromToday(days: number, now = new Date()): Date {
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - days);
  return start;
}

/** True when the job's posted/created date matches the selected preset. */
export function jobMatchesDatePostedFilter(job: JobListRow, datePostedFilter: string): boolean {
  if (!datePostedFilter) return true;
  const posted = jobPostedAt(job);
  if (!posted) return false;
  const now = new Date();
  const today = startOfLocalDay(now);

  switch (datePostedFilter) {
    case "today":
      return posted >= today;
    case "last_7":
      return posted >= daysAgoFromToday(7, now);
    case "last_14":
      return posted >= daysAgoFromToday(14, now);
    case "last_30":
      return posted >= daysAgoFromToday(30, now);
    case "last_90":
      return posted >= daysAgoFromToday(90, now);
    case "older_90":
      return posted < daysAgoFromToday(90, now);
    default:
      return true;
  }
}

type FilterOptions = {
  professions: string[];
  employmentTypes: string[];
  locations: string[];
  placementTypes: string[];
  specialties: string[];
  contractGroups: string[];
  w2Types: string[];
  sourceTypes: string[];
  workflows: string[];
};

type EditJobsFiltersModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: JobsExtendedFilterValues;
  options: FilterOptions;
  onSave: (next: JobsExtendedFilterValues) => void;
};

const FIELD_SURFACE =
  "rounded-lg border border-[#CBD5E1] bg-white h-10 w-full min-w-0 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0";

const SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

function ModalFilterField({
  label,
  value,
  onChange,
  placeholder = "All",
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-[#475569]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`${FIELD_SURFACE} ${value ? "text-[#334155]" : "text-[#94A3B8]"}`}
        style={{ ...CANDIDATES_PAGE_SUBTITLE_STYLE, ...SELECT_CHEVRON }}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  );
}

export function EditJobsFiltersModal({
  open,
  onOpenChange,
  value,
  options,
  onSave,
}: EditJobsFiltersModalProps) {
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const [draft, setDraft] = useState<JobsExtendedFilterValues>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function setField<K extends keyof JobsExtendedFilterValues>(key: K, next: JobsExtendedFilterValues[K]) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 data-[state=open]:animate-in fade-in" />
        <Dialog.Content
          style={brandVars}
          className="fixed inset-x-0 bottom-0 top-auto z-[101] flex h-[94dvh] max-h-[94dvh] w-full max-w-full translate-x-0 translate-y-0 flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(680px,calc(100vh-2rem))] sm:max-h-[calc(100vh-2rem)] sm:w-[min(720px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-zinc-200"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 sm:hidden" aria-hidden />

          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0 pr-3">
              <Dialog.Title className="truncate text-lg font-semibold leading-6 text-gray-800 sm:text-2xl sm:leading-8">
                Edit Filters
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Choose additional filters to narrow the jobs list.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black text-white hover:opacity-90 sm:h-8 sm:w-8 sm:p-1.5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-6">
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 sm:gap-5">
              <ModalFilterField
                label="Profession"
                value={draft.profession}
                onChange={(v) => setField("profession", v)}
              >
                {options.professions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Status"
                value={draft.status}
                onChange={(v) => setField("status", v)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </ModalFilterField>

              <ModalFilterField
                label="Employment Type"
                value={draft.employmentType}
                onChange={(v) => setField("employmentType", v)}
              >
                {options.employmentTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Location"
                value={draft.location}
                onChange={(v) => setField("location", v)}
              >
                {options.locations.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Placement Type"
                value={draft.placementType}
                onChange={(v) => setField("placementType", v)}
              >
                {options.placementTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Specialty"
                value={draft.specialty}
                onChange={(v) => setField("specialty", v)}
              >
                {options.specialties.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Contract Group"
                value={draft.contractGroup}
                onChange={(v) => setField("contractGroup", v)}
              >
                {options.contractGroups.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="W2 / 1099"
                value={draft.w2Type}
                onChange={(v) => setField("w2Type", v)}
              >
                {options.w2Types.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Source Type"
                value={draft.sourceType}
                onChange={(v) => setField("sourceType", v)}
              >
                {options.sourceTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Assigned Workflow"
                value={draft.workflow}
                onChange={(v) => setField("workflow", v)}
              >
                {options.workflows.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Pay Rate"
                value={draft.payRate}
                onChange={(v) => setField("payRate", v)}
              >
                {JOB_PAY_RATE_FILTER_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </ModalFilterField>

              <ModalFilterField
                label="Date Posted"
                value={draft.datePosted}
                onChange={(v) => setField("datePosted", v)}
              >
                {JOB_DATE_POSTED_FILTER_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </ModalFilterField>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY_JOBS_EXTENDED_FILTERS })}
              className="h-12 flex-1 rounded-lg border border-[#CBD5E1] px-4 text-sm font-medium text-[#475569] transition hover:bg-zinc-50 sm:h-auto sm:flex-none sm:px-5 sm:py-2"
            >
              Reset Filters
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="h-12 flex-1 rounded-lg border border-[color:var(--brand-primary)] px-4 text-sm font-medium text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] sm:h-auto sm:flex-none sm:px-5 sm:py-2"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
              className="h-12 flex-1 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)] sm:h-auto sm:flex-none sm:px-5 sm:py-2"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
