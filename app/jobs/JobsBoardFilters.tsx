"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  countSecondaryJobsBoardFilters,
  hasSecondaryJobsBoardFilters,
  JOB_LOCATION_TYPES,
  jobsBoardActiveChips,
  type JobsBoardActiveChip,
  type JobsBoardUrlState,
} from "@/lib/jobs/public-jobs-board";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";

type Option = { id: string; name: string; profession_id?: string };

const searchInputClass =
  "min-h-11 w-full border-0 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-0";
const chipSelectClass =
  "min-h-11 min-w-[9.5rem] cursor-pointer appearance-none rounded-full border border-slate-200 bg-white bg-[length:14px_14px] bg-[position:right_10px_center] bg-no-repeat px-3.5 pr-8 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_28%,transparent)] motion-reduce:transition-none bg-[url(\"data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  ) +
  '")]';
const sheetSelectClass =
  "min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_28%,transparent)]";

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
          <select
            aria-label="Profession"
            value={professionId}
            onChange={(event) => onProfessionChange(event.target.value)}
            className={chipSelectClass}
          >
            <option value="">Profession</option>
            {professions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Employment type"
            value={employmentType}
            onChange={(event) => onEmploymentTypeChange(event.target.value)}
            className={chipSelectClass}
          >
            <option value="">Employment type</option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                data-testid="jobs-all-filters"
                className="relative inline-flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_28%,transparent)]"
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
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl outline-none focus:outline-none min-[1024px]:inset-auto min-[1024px]:left-1/2 min-[1024px]:top-1/2 min-[1024px]:w-[min(32rem,calc(100vw-2rem))] min-[1024px]:-translate-x-1/2 min-[1024px]:-translate-y-1/2 min-[1024px]:rounded-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <Dialog.Title className="text-base font-semibold text-slate-900">
                    All filters
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close filters"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                    >
                      ×
                    </button>
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Profession
                    <select
                      aria-label="Profession"
                      value={professionId}
                      onChange={(event) => onProfessionChange(event.target.value)}
                      className={`${sheetSelectClass} mt-1.5`}
                    >
                      <option value="">All professions</option>
                      {professions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Specialty
                    <select
                      aria-label="Specialty"
                      value={specialtyId}
                      onChange={(event) => onSpecialtyChange(event.target.value)}
                      className={`${sheetSelectClass} mt-1.5`}
                    >
                      <option value="">All specialties</option>
                      {specialties.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Employment type
                    <select
                      aria-label="Employment type"
                      value={employmentType}
                      onChange={(event) => onEmploymentTypeChange(event.target.value)}
                      className={`${sheetSelectClass} mt-1.5`}
                    >
                      <option value="">All employment types</option>
                      {EMPLOYMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Workplace type
                    <select
                      aria-label="Workplace type"
                      value={locationType}
                      onChange={(event) => onLocationTypeChange(event.target.value)}
                      className={`${sheetSelectClass} mt-1.5`}
                    >
                      <option value="">All workplace types</option>
                      {JOB_LOCATION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={onClearSecondary}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
                  >
                    Reset
                  </button>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white"
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
              className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
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
                className="inline-flex min-h-11 items-center gap-1 rounded-full bg-slate-100 pl-3 text-sm text-slate-800"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={() => onRemoveChip(chip.key)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 hover:text-slate-800"
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
