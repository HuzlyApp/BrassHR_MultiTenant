"use client";

import { useEffect, useMemo, useState } from "react";
import { JobsBoardPillMenu } from "@/app/jobs/JobsBoardPillMenu";
import {
  hasSecondaryJobsBoardFilters,
  JOB_LOCATION_TYPES,
  jobsBoardActiveChips,
  type JobsBoardActiveChip,
  type JobsBoardUrlState,
} from "@/lib/jobs/public-jobs-board";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";

type Option = { id: string; name: string; profession_id?: string };

const searchInputClass =
  "min-h-10 w-full border-0 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-0";

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
  onEmploymentTypeChange: (value: string) => void;
  onLocationTypeChange: (value: string) => void;
  onSearch: () => void;
  onClearSecondary: () => void;
  onRemoveChip: (key: JobsBoardActiveChip["key"]) => void;
}) {
  const [filtersRowOpen, setFiltersRowOpen] = useState(false);
  const filterState: Pick<
    JobsBoardUrlState,
    "professionId" | "specialtyId" | "employmentType" | "locationType"
  > = { professionId, specialtyId, employmentType, locationType };
  const professionName = professions.find((item) => item.id === professionId)?.name;
  const specialtyName = specialties.find((item) => item.id === specialtyId)?.name;
  const employmentOptions = useMemo(() => employmentTypeOptions("All employment types"), []);
  const workplaceOptions = useMemo(() => workplaceTypeOptions("All workplace types"), []);
  // Workplace type applies to W2 / 1099 (and All); Contract postings don't use it.
  const showWorkplaceTypeFilter = employmentType !== "Contract";
  const chipState = showWorkplaceTypeFilter
    ? filterState
    : { ...filterState, locationType: "" };
  const hasSecondary = hasSecondaryJobsBoardFilters(chipState);
  const chips = jobsBoardActiveChips(chipState, {
    profession: professionName,
    specialty: specialtyName,
  });

  useEffect(() => {
    if (hasSecondary) setFiltersRowOpen(true);
  }, [hasSecondary]);

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <form
          className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-1 sm:flex-row sm:items-center"
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
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-5 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            Search
          </button>
        </form>

        <button
          type="button"
          data-testid="jobs-filters-row-toggle"
          aria-expanded={filtersRowOpen}
          aria-controls="jobs-board-filter-row"
          onClick={() => setFiltersRowOpen((open) => !open)}
          title={filtersRowOpen ? "Hide filters" : "Show filters"}
          className={`relative inline-flex size-10 shrink-0 items-center justify-center self-center rounded-lg border bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none ${
            filtersRowOpen || hasSecondary
              ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[color:var(--brand-primary)]"
              : "border-slate-200 text-[color:var(--brand-primary)] hover:border-[color:color-mix(in_srgb,var(--brand-primary)_40%,#e2e8f0)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="shrink-0"
          >
            <path
              d="M2.5 4.5H13.5M4.5 8H11.5M6.5 11.5H9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">{filtersRowOpen ? "Hide filters" : "Show filters"}</span>
          {hasSecondary && !filtersRowOpen ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[color:var(--brand-primary)] ring-2 ring-white"
              aria-hidden
            />
          ) : null}
        </button>
      </div>

      <div
        id="jobs-board-filter-row"
        className={filtersRowOpen ? "flex flex-col gap-2" : "hidden"}
      >
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <JobsBoardPillMenu
            value={employmentType}
            options={employmentOptions}
            onChange={onEmploymentTypeChange}
            ariaLabel="Employment type"
            placeholder="Employment type"
          />
          {showWorkplaceTypeFilter ? (
            <JobsBoardPillMenu
              value={locationType}
              options={workplaceOptions}
              onChange={onLocationTypeChange}
              ariaLabel="Workplace type"
              placeholder="Workplace type"
            />
          ) : null}
          {hasSecondary ? (
            <button
              type="button"
              onClick={onClearSecondary}
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-[color:var(--brand-primary)] underline-offset-2 hover:underline"
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
                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] pl-3 text-sm text-[color:var(--brand-primary)]"
              >
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={() => onRemoveChip(chip.key)}
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)]"
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
