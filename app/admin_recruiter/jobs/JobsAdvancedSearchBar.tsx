"use client";

import { useEffect, useState } from "react";
import { FilterChipInput } from "@/app/admin_recruiter/components/FilterChipInput";
import { parseSkillsFilterParam } from "@/lib/jobs/application-skills-filter";
import { buildJobsSearchApplyPayload } from "@/lib/jobs/jobs-list-search";

const JOBS_ICONS = "/icons/jobs-icons";
const CANDIDATES_ICONS = "/icons/candidates-icons";

const PRIMARY_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold leading-4 text-white transition hover:brightness-95";

const OUTLINE_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-semibold leading-4 text-[#475569] transition hover:bg-zinc-50";

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

function JobSearchIcon() {
  return <ListingGlyph src={`${JOBS_ICONS}/search.svg`} outer={20} leafWidth={16.67} leafHeight={16.67} />;
}

function ResetSearchIcon() {
  return <ListingGlyph src={`${CANDIDATES_ICONS}/reset-search.svg`} outer={16} leafWidth={16} leafHeight={16} />;
}

function skillsKey(skills: string[]): string {
  return skills.map((skill) => skill.trim().toLowerCase()).filter(Boolean).join("|");
}

export type JobsAdvancedSearchBarProps = {
  query: string;
  skillsFilter: string;
  onApplySearch: (next: { query: string; skillsFilter: string }) => void;
  onResetSearch: () => void;
  searching?: boolean;
};

/**
 * Candidates-style advanced search: job title text + skill tags (AND when both set).
 */
export function JobsAdvancedSearchBar({
  query,
  skillsFilter,
  onApplySearch,
  onResetSearch,
  searching = false,
}: JobsAdvancedSearchBarProps) {
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftSkillTags, setDraftSkillTags] = useState(() => parseSkillsFilterParam(skillsFilter));

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    setDraftSkillTags(parseSkillsFilterParam(skillsFilter));
  }, [skillsFilter]);

  const appliedSkillTags = parseSkillsFilterParam(skillsFilter);
  const searchDirty =
    draftQuery.trim() !== query.trim() || skillsKey(draftSkillTags) !== skillsKey(appliedSkillTags);
  const hasAppliedSearch = Boolean(query.trim() || appliedSkillTags.length);
  const hasDraftSearch = Boolean(draftQuery.trim() || draftSkillTags.length);

  function submitSearch(skillTags = draftSkillTags) {
    if (searching) return;
    onApplySearch(buildJobsSearchApplyPayload({ query: draftQuery, skillTags }));
  }

  function resetSearch() {
    if (searching) return;
    setDraftQuery("");
    setDraftSkillTags([]);
    onResetSearch();
  }

  return (
    <div className="flex w-full flex-col gap-3.5 border-b border-[#E5E7EB] px-[14px] py-3.5">
      <div className="flex w-full flex-col gap-3 rounded-lg border border-[#E5E7EB] p-1.5 sm:flex-row sm:items-center sm:gap-3.5 sm:px-2 sm:py-1.5">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md sm:flex-row sm:items-center">
          <label className="flex min-h-10 min-w-0 flex-1 items-center gap-3 border-[#E5E7EB] p-2 sm:border-r">
            <JobSearchIcon />
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
              placeholder="Search by job name, location, MSP/client, or profession"
              aria-label="Search by job name, location, MSP client, or profession"
              title="Search by job name, location, MSP/client name, or profession"
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
            title="Search uses AND when both text and skills are set"
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
        Search matches job name, location, MSP/client, or profession. Text and skills can be used alone
        or together; when both are set, results must match both (AND).
      </p>
    </div>
  );
}
