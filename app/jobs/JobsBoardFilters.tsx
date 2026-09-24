"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FilterChipInput,
  type FilterChipInputHandle,
} from "@/app/admin_recruiter/components/FilterChipInput";
import { JobsBoardPillMenu } from "@/app/jobs/JobsBoardPillMenu";
import {
  hasSecondaryJobsBoardFilters,
  JOB_LOCATION_TYPES,
  jobsBoardActiveChips,
  parsePublicJobsQueryTags,
  serializePublicJobsQueryTags,
  type JobsBoardActiveChip,
  type JobsBoardUrlState,
} from "@/lib/jobs/public-jobs-board";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";

type Option = { id: string; name: string; profession_id?: string };

const SEARCH_PLACEHOLDER = "Search by job title, skills, experience, location...";

function employmentTypeOptions(emptyLabel: string) {
  return [{ value: "", label: emptyLabel }, ...EMPLOYMENT_TYPES.map((type) => ({ value: type, label: type }))];
}

function workplaceTypeOptions(emptyLabel: string) {
  return [{ value: "", label: emptyLabel }, ...JOB_LOCATION_TYPES.map((type) => ({ value: type, label: type }))];
}

function tagsKey(tags: string[]): string {
  return tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).join("|");
}

export function JobsBoardFilters({
  queryTags,
  professionId,
  specialtyId,
  employmentType,
  locationType,
  professions,
  specialties,
  onSearch,
  onResetSearch,
  onClearSecondary,
  onEmploymentTypeChange,
  onLocationTypeChange,
  onRemoveChip,
}: {
  queryTags: string[];
  professionId: string;
  specialtyId: string;
  employmentType: string;
  locationType: string;
  professions: Option[];
  specialties: Option[];
  onSearch: (queryTags: string[]) => void;
  onResetSearch: () => void;
  onClearSecondary: () => void;
  onEmploymentTypeChange: (value: string) => void;
  onLocationTypeChange: (value: string) => void;
  onRemoveChip: (key: JobsBoardActiveChip["key"]) => void;
}) {
  const keywordChipRef = useRef<FilterChipInputHandle>(null);
  const [draftTags, setDraftTags] = useState(queryTags);
  const [draftText, setDraftText] = useState("");
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

  useEffect(() => {
    setDraftTags(queryTags);
    setDraftText("");
  }, [queryTags]);

  const chipState = {
    professionId,
    specialtyId,
    employmentType,
    locationType: showWorkplaceTypeFilter ? locationType : "",
  };
  const hasSecondary = hasSecondaryJobsBoardFilters({
    ...filterState,
    locationType: showWorkplaceTypeFilter ? locationType : "",
  });
  const chips = jobsBoardActiveChips(chipState, {
    profession: professionName,
    specialty: specialtyName,
  });
  const hasAppliedSearch = queryTags.length > 0;
  const hasDraftSearch = draftTags.length > 0 || Boolean(draftText.trim());
  const searchDirty = tagsKey(draftTags) !== tagsKey(queryTags) || Boolean(draftText.trim());
  const hasFilterChips = chips.length > 0;

  useEffect(() => {
    if (hasSecondary || hasAppliedSearch) setFiltersRowOpen(true);
  }, [hasAppliedSearch, hasSecondary]);

  function normalizeTags(tags: string[]) {
    return parsePublicJobsQueryTags(serializePublicJobsQueryTags(tags));
  }

  function submitSearch(nextTags?: string[]) {
    const committed = nextTags ?? keywordChipRef.current?.commitDraft() ?? draftTags;
    const normalized = normalizeTags(committed);
    setDraftTags(normalized);
    setDraftText("");
    onSearch(normalized);
  }

  function resetSearch() {
    keywordChipRef.current?.clearDraft();
    setDraftTags([]);
    setDraftText("");
    onResetSearch();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <form
          className="flex min-w-0 flex-1 flex-row items-center gap-2 rounded-lg border border-slate-200 bg-white p-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
          aria-label="Search open positions"
        >
          <div className="min-w-0 flex-1 px-2 py-0.5">
            <FilterChipInput
              ref={keywordChipRef}
              embedded
              values={draftTags}
              placeholder={SEARCH_PLACEHOLDER}
              aria-label={SEARCH_PLACEHOLDER}
              onChange={setDraftTags}
              onDraftTextChange={setDraftText}
              onEnterSubmit={(tags) => {
                submitSearch(tags);
              }}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 pr-0.5">
            <button
              type="submit"
              disabled={!searchDirty && !hasDraftSearch && !hasAppliedSearch}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none sm:px-5"
            >
              Search
            </button>
            {hasAppliedSearch ? (
              <button
                type="button"
                data-testid="jobs-reset-search"
                onClick={resetSearch}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                Reset search
              </button>
            ) : null}
          </div>
        </form>

        <button
          type="button"
          data-testid="jobs-filters-row-toggle"
          aria-expanded={filtersRowOpen}
          aria-controls="jobs-board-filter-row"
          onClick={() => setFiltersRowOpen((open) => !open)}
          title={filtersRowOpen ? "Hide filters" : "Show filters"}
          className={`relative inline-flex size-10 shrink-0 items-center justify-center self-center rounded-lg border bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none ${
            filtersRowOpen || hasFilterChips || hasAppliedSearch
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
          {(hasFilterChips || hasAppliedSearch) && !filtersRowOpen ? (
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
          {hasFilterChips || hasAppliedSearch ? (
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
