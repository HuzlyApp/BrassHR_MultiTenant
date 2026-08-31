"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { JobsBoardPillMenu, jobsBoardPillTriggerClass } from "@/app/jobs/JobsBoardPillMenu";
import {
  countSecondaryJobsBoardFilters,
  hasSecondaryJobsBoardFilters,
  JOB_LOCATION_TYPES,
  jobsBoardActiveChips,
  type JobsBoardActiveChip,
  type JobsBoardUrlState,
} from "@/lib/jobs/public-jobs-board";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";

type Option = { id: string; name: string; profession_id?: string };

const searchInputClass =
  "min-h-11 w-full border-0 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-0";

function withEmptyOption(options: Option[], emptyLabel: string) {
  return [{ value: "", label: emptyLabel }, ...options.map((item) => ({ value: item.id, label: item.name }))];
}

function employmentTypeOptions(emptyLabel: string) {
  return [{ value: "", label: emptyLabel }, ...EMPLOYMENT_TYPES.map((type) => ({ value: type, label: type }))];
}

function workplaceTypeOptions(emptyLabel: string) {
  return [{ value: "", label: emptyLabel }, ...JOB_LOCATION_TYPES.map((type) => ({ value: type, label: type }))];
}

export function JobsBoardFilters({
  query,
  location,
  professionId,
  specialtyId,
  employmentType,
  locationType,
  professions,
  specialties,
  onQueryChange,
  onLocationChange,
  onProfessionChange,
  onSpecialtyChange,
  onEmploymentTypeChange,
  onLocationTypeChange,
  onSearch,
  onClearSecondary,
  onRemoveChip,
}: {
  query: string;
  location: string;
  professionId: string;
  specialtyId: string;
  employmentType: string;
  locationType: string;
  professions: Option[];
  specialties: Option[];
  onQueryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onProfessionChange: (value: string) => void;
  onSpecialtyChange: (value: string) => void;
  onEmploymentTypeChange: (value: string) => void;
  onLocationTypeChange: (value: string) => void;
  onSearch: () => void;
  onClearSecondary: () => void;
  onRemoveChip: (key: JobsBoardActiveChip["key"]) => void;
}) {
  const branding = useTenantBranding();
  const brandStyle = useMemo(
    () => brandingToCssVars(branding) as CSSProperties,
    [branding]
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterState: Pick<
    JobsBoardUrlState,
    "professionId" | "specialtyId" | "employmentType" | "locationType"
  > = { professionId, specialtyId, employmentType, locationType };
  const secondaryCount = countSecondaryJobsBoardFilters(filterState);
  const hasSecondary = hasSecondaryJobsBoardFilters(filterState);
  const professionName = professions.find((item) => item.id === professionId)?.name;
  const specialtyName = specialties.find((item) => item.id === specialtyId)?.name;
  const chips = jobsBoardActiveChips(filterState, {
    profession: professionName,
    specialty: specialtyName,
  });

  const professionOptions = useMemo(
    () => withEmptyOption(professions, "All professions"),
    [professions]
  );
  const specialtyOptions = useMemo(
    () => withEmptyOption(specialties, "All specialties"),
    [specialties]
  );
  const employmentOptions = useMemo(() => employmentTypeOptions("All employment types"), []);
  const workplaceOptions = useMemo(() => workplaceTypeOptions("All workplace types"), []);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
        aria-label="Search open positions"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search jobs, titles, or keywords</span>
          <input
            aria-label="Search jobs, titles, or keywords"
            placeholder="Search jobs, titles, or keywords"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className={searchInputClass}
          />
        </label>
        <div className="hidden h-7 w-px bg-slate-200 sm:block" aria-hidden />
        <label className="min-w-0 flex-1">
          <span className="sr-only">City, state, country, or remote</span>
          <input
            aria-label="Location"
            placeholder="City, state, country, or remote"
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
            className={searchInputClass}
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-5 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          Search
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <JobsBoardPillMenu
            value={professionId}
            options={professionOptions}
            onChange={onProfessionChange}
            ariaLabel="Profession"
            placeholder="Profession"
          />
          <JobsBoardPillMenu
            value={employmentType}
            options={employmentOptions}
            onChange={onEmploymentTypeChange}
            ariaLabel="Employment type"
            placeholder="Employment type"
          />
          <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                data-testid="jobs-all-filters"
                className={`${jobsBoardPillTriggerClass} relative shrink-0 ${
                  secondaryCount > 0
                    ? "border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#e2e8f0)] font-medium text-[color:var(--brand-primary)]"
                    : ""
                }`}
              >
                All filters
                {secondaryCount > 0 ? (
                  <span className="ml-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--brand-primary)] px-1.5 text-[11px] font-semibold text-white">
                    {secondaryCount}
                  </span>
                ) : null}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 data-[state=open]:animate-none" />
              <Dialog.Content
                aria-describedby={undefined}
                style={brandStyle}
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border border-[color:color-mix(in_srgb,var(--brand-primary)_22%,#e2e8f0)] bg-white shadow-xl outline-none focus:outline-none min-[1024px]:inset-auto min-[1024px]:left-1/2 min-[1024px]:top-1/2 min-[1024px]:w-[min(32rem,calc(100vw-2rem))] min-[1024px]:-translate-x-1/2 min-[1024px]:-translate-y-1/2 min-[1024px]:rounded-2xl"
              >
                <div
                  className="h-1.5 w-full shrink-0 bg-[color:var(--brand-primary)]"
                  aria-hidden
                />
                <div className="flex items-center justify-between border-b border-[color:color-mix(in_srgb,var(--brand-primary)_12%,#f1f5f9)] bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] px-5 py-4">
                  <Dialog.Title className="text-base font-semibold text-slate-900 no-underline outline-none">
                    All filters
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close filters"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] hover:text-[color:var(--brand-primary)]"
                    >
                      ×
                    </button>
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[color:color-mix(in_srgb,var(--brand-primary)_3%,white)] px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--brand-primary)]">Profession</p>
                    <JobsBoardPillMenu
                      value={professionId}
                      options={professionOptions}
                      onChange={onProfessionChange}
                      ariaLabel="Profession"
                      placeholder="All professions"
                      variant="field"
                      align="start"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[color:var(--brand-primary)]">Specialty</p>
                    <JobsBoardPillMenu
                      value={specialtyId}
                      options={specialtyOptions}
                      onChange={onSpecialtyChange}
                      ariaLabel="Specialty"
                      placeholder="All specialties"
                      variant="field"
                      align="start"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[color:var(--brand-primary)]">Employment type</p>
                    <JobsBoardPillMenu
                      value={employmentType}
                      options={employmentOptions}
                      onChange={onEmploymentTypeChange}
                      ariaLabel="Employment type"
                      placeholder="All employment types"
                      variant="field"
                      align="start"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[color:var(--brand-primary)]">Workplace type</p>
                    <JobsBoardPillMenu
                      value={locationType}
                      options={workplaceOptions}
                      onChange={onLocationTypeChange}
                      ariaLabel="Workplace type"
                      placeholder="All workplace types"
                      variant="field"
                      align="start"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="flex gap-2 border-t border-[color:color-mix(in_srgb,var(--brand-primary)_12%,#f1f5f9)] bg-[color:color-mix(in_srgb,var(--brand-primary)_5%,white)] px-5 py-4">
                  <button
                    type="button"
                    onClick={onClearSecondary}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--brand-primary)_28%,#e2e8f0)] bg-white px-4 text-sm font-medium text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                  >
                    Reset
                  </button>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                      Show results
                    </button>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          {hasSecondary ? (
            <button
              type="button"
              onClick={onClearSecondary}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-[color:var(--brand-primary)] underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {chips.length ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {chips.map((chip) => (
              <span
                key={chip.key}
                data-testid={`jobs-active-chip-${chip.key}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] pl-3 text-sm text-[color:var(--brand-primary)]"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={() => onRemoveChip(chip.key)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
