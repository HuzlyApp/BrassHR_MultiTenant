"use client";

import { useEffect, useState } from "react";
import { JobsViewToggle } from "@/app/admin_recruiter/jobs/JobsViewToggle";

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

function UserAddIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/user-add.svg`} outer={16} leafWidth={13.36} leafHeight={12.46} />;
}

function MatchExistingIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/match-existing.svg`} outer={16} leafWidth={12.17} leafHeight={14.16} />;
}

export type AllCandidatesToolbarProps = {
  query: string;
  skillsFilter: string;
  onApplySearch: (next: { query: string; skillsFilter: string }) => void;
  onResetSearch: () => void;
  onOpenFilters: () => void;
  onEditColumns: () => void;
  onAddCandidate?: () => void;
  onMatchExistingCandidate?: () => void;
  activeFilterCount: number;
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
  highlightMultiJob: boolean;
  onHighlightMultiJobChange: (value: boolean) => void;
};

function HighlightMultiJobToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="relative h-6 w-10 shrink-0"
        aria-label="Highlight Multi-Job Applicants"
      >
        <span
          className={`absolute left-1/2 top-1/2 h-5 w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-[45px] transition-colors ${
            on ? "bg-[color:var(--brand-secondary,#012352)]" : "bg-[#CBD5E1]"
          }`}
        />
        <span
          className={`absolute top-1 size-4 rounded-[20px] bg-white shadow-sm transition-[left] ${
            on ? "left-5" : "left-1"
          }`}
        />
      </button>
      <span className="text-xs font-normal leading-4 text-[#374151]">Highlight Multi-Job Applicants</span>
    </div>
  );
}

export function AllCandidatesToolbar({
  query,
  skillsFilter,
  onApplySearch,
  onResetSearch,
  onOpenFilters,
  onEditColumns,
  onAddCandidate,
  onMatchExistingCandidate,
  activeFilterCount,
  view,
  onViewChange,
  highlightMultiJob,
  onHighlightMultiJobChange,
}: AllCandidatesToolbarProps) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftSkills, setDraftSkills] = useState(skillsFilter);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setDraftSkills(skillsFilter);
  }, [skillsFilter]);

  const searchDirty =
    draftQuery.trim() !== query.trim() || draftSkills.trim() !== skillsFilter.trim();
  const hasAppliedSearch = Boolean(query.trim() || skillsFilter.trim());

  function submitSearch() {
    onApplySearch({
      query: draftQuery.trim(),
      skillsFilter: draftSkills.trim(),
    });
  }

  function resetSearch() {
    setDraftQuery("");
    setDraftSkills("");
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
                className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-[#374151] outline-none placeholder:text-[#374151]/40"
              />
            </label>
            <label className="flex min-h-9 min-w-0 flex-1 items-center px-4 py-2">
              <input
                type="search"
                value={draftSkills}
                onChange={(event) => setDraftSkills(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Filter by Skills"
                aria-label="Filter by Skills"
                className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-[#374151] outline-none placeholder:text-[#374151]/40"
              />
            </label>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">
            <button
              type="button"
              onClick={submitSearch}
              disabled={!searchDirty && !draftQuery.trim() && !draftSkills.trim()}
              className={`${PRIMARY_TOOLBAR_BUTTON_CLASS} flex-1 sm:flex-none`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={resetSearch}
              disabled={!hasAppliedSearch && !draftQuery.trim() && !draftSkills.trim()}
              className={`${OUTLINE_TOOLBAR_BUTTON_CLASS} flex-1 sm:flex-none disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <ResetSearchIcon />
              Reset search
            </button>
          </div>
        </div>
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
            aria-label="More filters"
            title="Filters"
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
          {onAddCandidate ? (
            <button type="button" onClick={onAddCandidate} className={`${PRIMARY_TOOLBAR_BUTTON_CLASS} w-full sm:w-auto`}>
              <UserAddIcon />
              Add Candidate
            </button>
          ) : null}
          {onMatchExistingCandidate ? (
            <button
              type="button"
              onClick={onMatchExistingCandidate}
              className={`${OUTLINE_TOOLBAR_BUTTON_CLASS} w-full sm:w-auto`}
            >
              <MatchExistingIcon />
              Match Existing Candidate
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 px-3 pb-2 pt-5 sm:px-5">
        <HighlightMultiJobToggle
          on={highlightMultiJob}
          onToggle={() => onHighlightMultiJobChange(!highlightMultiJob)}
        />
        <JobsViewToggle
          value={view === "list" ? "list" : "grid"}
          onChange={(next) => onViewChange(next === "list" ? "list" : "card")}
        />
      </div>
    </>
  );
}
