"use client";

import { useEffect, useState } from "react";
import { FilterChipInput } from "@/app/admin_recruiter/components/FilterChipInput";
import JobPublishToggle from "@/app/admin_recruiter/jobs/JobPublishToggle";
import { parseSkillsFilterParam } from "@/lib/jobs/application-skills-filter";
import { buildCandidatesSearchApplyPayload } from "@/lib/workers/candidates-search-ui";

const CANDIDATES_ICONS = "/icons/candidates-icons";

const PRIMARY_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold leading-4 text-white transition hover:brightness-95";

const OUTLINE_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-semibold leading-4 text-[#475569] transition hover:bg-zinc-50";

const ICON_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 w-9 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-zinc-50";

function ListingGlyph({
  src,
  outer,
  leafWidth,
  leafHeight,
}: {
  src: string;
  outer: number;
  leafWidth: number;
  leafHeight: number;
}) {
  return (
    <span className="relative shrink-0 overflow-hidden" style={{ width: outer, height: outer }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={leafWidth}
        height={leafHeight}
        className="absolute left-1/2 top-1/2 shrink-0 -translate-x-1/2 -translate-y-1/2"
        style={{ width: leafWidth, height: leafHeight }}
      />
    </span>
  );
}

function UserSearchIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/user-search.svg`} outer={24} leafWidth={17} leafHeight={19} />;
}

function ResetSearchIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/reset-search.svg`} outer={16} leafWidth={16} leafHeight={16} />;
}

function ColumnsIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/columns-icon-btn.svg`} outer={16} leafWidth={16} leafHeight={16} />;
}

function FiltersIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/filters-icon-btn.svg`} outer={16} leafWidth={16} leafHeight={16} />;
}

function AnalyzeSparklesIcon() {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path
          d="M12 3l1.2 4.2L17.5 8.5 13.2 9.8 12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3zM18.5 13.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3zM6.2 14.5l.55 1.8 1.8.55-1.8.55-.55 1.8-.55-1.8-1.8-.55 1.8-.55.55-1.8z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function UserAddIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/user-add.svg`} outer={16} leafWidth={13.36} leafHeight={12.46} />;
}

function MatchExistingIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/match-existing.svg`} outer={16} leafWidth={12.17} leafHeight={14.16} />;
}

function skillsKey(skills: string[]): string {
  return skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean).join("|");
}

function HighlightMultiJobToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <JobPublishToggle
        checked={on}
        onChange={onToggle}
        ariaLabel="Highlight Multi-Job Applicants"
      />
      <span className="text-xs font-normal leading-4 text-[#374151]">Highlight Multi-Job Applicants</span>
    </div>
  );
}

export type ApplicationsListToolbarProps = {
  query: string;
  skillsFilter: string[];
  onApplySearch: (next: { query: string; skills: string[] }) => void;
  onResetSearch: () => void;
  onOpenFilters: () => void;
  onEditColumns: () => void;
  onAddCandidate: () => void;
  onMatchExistingCandidate: () => void;
  activeFilterCount: number;
  highlightMultiJob: boolean;
  onHighlightMultiJobChange: (value: boolean) => void;
  searching?: boolean;
  onAnalyzeAll?: () => void;
  analyzeAllLabel?: string;
  analyzeBusy?: boolean;
  analyzeDisabled?: boolean;
};

/**
 * Old-candidates-style toolbar: advanced search + icon columns/filters + Add / Match Existing.
 * Attribute filters live only in the All Filters modal (not inline).
 */
export function ApplicationsListToolbar({
  query,
  skillsFilter,
  onApplySearch,
  onResetSearch,
  onOpenFilters,
  onEditColumns,
  onAddCandidate,
  onMatchExistingCandidate,
  activeFilterCount,
  highlightMultiJob,
  onHighlightMultiJobChange,
  searching = false,
  onAnalyzeAll,
  analyzeAllLabel = "Analyze all",
  analyzeBusy = false,
  analyzeDisabled = false,
}: ApplicationsListToolbarProps) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftSkillTags, setDraftSkillTags] = useState(() => [...skillsFilter]);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setDraftSkillTags([...skillsFilter]);
  }, [skillsFilter]);

  const searchDirty =
    draftQuery.trim() !== query.trim() || skillsKey(draftSkillTags) !== skillsKey(skillsFilter);
  const hasAppliedSearch = Boolean(query.trim() || skillsFilter.length);
  const hasDraftSearch = Boolean(draftQuery.trim() || draftSkillTags.length);

  function submitSearch(skillTags = draftSkillTags) {
    if (searching) return;
    const payload = buildCandidatesSearchApplyPayload({ query: draftQuery, skillTags });
    onApplySearch({
      query: payload.query,
      skills: parseSkillsFilterParam(payload.skillsFilter),
    });
  }

  function resetSearch() {
    if (searching) return;
    setDraftQuery("");
    setDraftSkillTags([]);
    onResetSearch();
  }

  return (
    <>
      <div className="flex w-full flex-col gap-3.5 border-b border-[#E5E7EB] px-3 py-3.5 sm:px-5">
        <div className="flex w-full flex-col gap-3 rounded-lg border border-[#E5E7EB] p-1.5 sm:flex-row sm:items-center sm:gap-3.5 sm:px-2 sm:py-1.5">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md sm:flex-row sm:items-center">
            <label className="flex min-h-10 min-w-0 flex-1 items-center gap-3 border-[#E5E7EB] p-2 sm:border-r">
              <UserSearchIcon />
              <input
                type="search"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Search applicant or resume"
                aria-label="Search applicant or resume"
                title="Search by name, email, phone, job title, or resume text"
                disabled={searching}
                className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-[#374151] outline-none placeholder:text-[#374151]/40 disabled:opacity-60 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-decoration]:cursor-pointer"
              />
            </label>
            <div className="flex min-h-9 min-w-0 flex-1 items-center px-3 py-1.5 sm:px-4">
              <FilterChipInput
                embedded
                values={draftSkillTags}
                placeholder="Filter by Skills"
                aria-label="Filter by Skills"
                onChange={setDraftSkillTags}
                onEnterSubmit={(nextSkills) => {
                  setDraftSkillTags(nextSkills);
                  submitSearch(nextSkills);
                }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">
            <button
              type="button"
              onClick={() => submitSearch()}
              disabled={searching || (!searchDirty && !hasDraftSearch)}
              title="Search uses AND when both applicant/resume text and skills are set"
              className={`${PRIMARY_TOOLBAR_BUTTON_CLASS} flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {searching ? "Searching…" : "Search"}
            </button>
            <button
              type="button"
              onClick={resetSearch}
              disabled={searching || (!hasAppliedSearch && !hasDraftSearch)}
              className={`${OUTLINE_TOOLBAR_BUTTON_CLASS} flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <ResetSearchIcon />
              Reset search
            </button>
          </div>
        </div>
        <p className="text-[11px] leading-4 text-[#64748B]">
          Applicant/resume and skills can be used alone or together. When both are set, results must match
          both (AND).
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 border-b border-[#E5E7EB] px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onEditColumns}
            className={ICON_TOOLBAR_BUTTON_CLASS}
            aria-label="Edit columns"
            title="Columns"
          >
            <ColumnsIcon />
          </button>
          <button
            type="button"
            onClick={onOpenFilters}
            className={`relative ${ICON_TOOLBAR_BUTTON_CLASS}`}
            aria-label="All filters"
            title="All Filters"
          >
            <FiltersIcon />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[color:var(--brand-primary)] px-1 text-[9px] font-semibold leading-4 text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3.5">
          {onAnalyzeAll ? (
            <button
              type="button"
              onClick={onAnalyzeAll}
              disabled={analyzeBusy || analyzeDisabled}
              title="Analyze all unanalyzed candidates for this job"
              className={`${OUTLINE_TOOLBAR_BUTTON_CLASS} w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <AnalyzeSparklesIcon />
              {analyzeBusy ? "Analyzing…" : analyzeAllLabel}
            </button>
          ) : null}
          <button type="button" onClick={onAddCandidate} className={`${PRIMARY_TOOLBAR_BUTTON_CLASS} w-full sm:w-auto`}>
            <UserAddIcon />
            Add Candidate
          </button>
          <button
            type="button"
            onClick={onMatchExistingCandidate}
            className={`${OUTLINE_TOOLBAR_BUTTON_CLASS} w-full sm:w-auto`}
          >
            <MatchExistingIcon />
            Match Existing Candidate
          </button>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 border-b border-[#E5E7EB] px-3 py-3.5 sm:px-5">
        <HighlightMultiJobToggle
          on={highlightMultiJob}
          onToggle={() => onHighlightMultiJobChange(!highlightMultiJob)}
        />
      </div>
    </>
  );
}
