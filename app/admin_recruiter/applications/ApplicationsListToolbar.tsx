"use client";

const JOBS_ICONS = "/icons/jobs-icons";
const CANDIDATES_ICONS = "/icons/candidates-icons";

const PRIMARY_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold leading-4 text-white transition hover:brightness-95";

const OUTLINE_TOOLBAR_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold leading-4 text-[#475569] transition hover:bg-zinc-50";

const COMPACT_FILTER_SELECT_CLASS =
  "inline-flex h-8 w-[150px] shrink-0 cursor-pointer appearance-none items-center overflow-hidden rounded-lg border border-[#CBD5E1] bg-white bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat px-3.5 pr-8 text-xs font-normal leading-4 text-[#374151] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0";

const FILTER_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

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

function ClaimClipboardIcon() {
  return (
    <ListingGlyph src={`${CANDIDATES_ICONS}/claim-clipboard.svg`} outer={16} leafWidth={10.83} leafHeight={13.5} />
  );
}

function ColumnsIcon() {
  return <ListingGlyph src={`${JOBS_ICONS}/columns.svg`} outer={16} leafWidth={12.33} leafHeight={10} />;
}

function MoreFiltersIcon() {
  return <ListingGlyph src={`${JOBS_ICONS}/more-filters.svg`} outer={16} leafWidth={13.5} leafHeight={13.5} />;
}

function CompactFilterSelect({
  value,
  onChange,
  placeholder,
  options,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${COMPACT_FILTER_SELECT_CLASS} ${className}`.trim()}
      style={FILTER_SELECT_CHEVRON}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export type ApplicationsListToolbarProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  scoreSort: string;
  onScoreSortChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  jobFilter: string;
  onJobFilterChange: (value: string) => void;
  jobFilterOptions: { value: string; label: string }[];
  showJobFilter: boolean;
  stageFilter: string;
  onStageFilterChange: (value: string) => void;
  stageOptions: { value: string; label: string }[];
  showFilterRows: boolean;
  onToggleFilterRows: () => void;
  locationFilter: string;
  onLocationFilterChange: (value: string) => void;
  locationOptions: string[];
  sortBy: "newest" | "oldest" | "matchScore" | "matchScoreAsc";
  onSortByChange: (value: "newest" | "oldest" | "matchScore" | "matchScoreAsc") => void;
  onClaimCandidates: () => void;
  onEditColumns: () => void;
  deleteButton: React.ReactNode;
  addCandidateButton: React.ReactNode;
  multiJobToggle: React.ReactNode;
};

export function ApplicationsListToolbar({
  searchQuery,
  onSearchQueryChange,
  scoreSort,
  onScoreSortChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  jobFilter,
  onJobFilterChange,
  jobFilterOptions,
  showJobFilter,
  stageFilter,
  onStageFilterChange,
  stageOptions,
  showFilterRows,
  onToggleFilterRows,
  locationFilter,
  onLocationFilterChange,
  locationOptions,
  sortBy,
  onSortByChange,
  onClaimCandidates,
  onEditColumns,
  deleteButton,
  addCandidateButton,
  multiJobToggle,
}: ApplicationsListToolbarProps) {
  return (
    <>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-3 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onClaimCandidates} className={PRIMARY_TOOLBAR_BUTTON_CLASS}>
            <ClaimClipboardIcon />
            Claim Candidates
          </button>
          <button type="button" onClick={onEditColumns} className={OUTLINE_TOOLBAR_BUTTON_CLASS}>
            <ColumnsIcon />
            Columns
          </button>
          {deleteButton}
        </div>
        {addCandidateButton}
      </div>

      <div className="flex w-full flex-wrap items-center gap-3 border-b border-[#E5E7EB] px-3 py-3.5 sm:gap-5 sm:px-5">
        <label className="flex h-8 w-full min-w-0 shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white px-2.5 sm:w-[252px] sm:max-w-[252px]">
          <span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${JOBS_ICONS}/search.svg`}
              alt=""
              width={16.67}
              height={16.67}
              className="size-[16.67px] shrink-0"
            />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search applicants..."
            aria-label="Search applicants"
            className="min-w-0 flex-1 bg-transparent text-xs font-light leading-4 text-[#334155] outline-none placeholder:text-[#94A3B8]"
          />
        </label>

        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:justify-end sm:gap-5">
          <CompactFilterSelect
            ariaLabel="Score"
            placeholder="Score (high-low)"
            value={scoreSort}
            onChange={onScoreSortChange}
            options={[
              { value: "high-low", label: "Score (high-low)" },
              { value: "low-high", label: "Score (low-high)" },
            ]}
          />
          <CompactFilterSelect
            ariaLabel="Status"
            placeholder="All Status"
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={statusOptions}
          />
          {showJobFilter ? (
            <CompactFilterSelect
              ariaLabel="Jobs"
              placeholder="All Jobs"
              value={jobFilter}
              onChange={onJobFilterChange}
              options={jobFilterOptions}
            />
          ) : null}
          <CompactFilterSelect
            ariaLabel="Stages"
            placeholder="Stages"
            value={stageFilter}
            onChange={onStageFilterChange}
            options={stageOptions}
          />
          <button
            type="button"
            onClick={onToggleFilterRows}
            aria-expanded={showFilterRows}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--brand-primary)] bg-white px-3 text-xs font-normal leading-4 text-[color:var(--brand-primary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)]"
          >
            <MoreFiltersIcon />
            More Filters
          </button>
        </div>
      </div>

      {showFilterRows ? (
        <div className="flex w-full flex-wrap items-center gap-3 border-b border-[#E5E7EB] px-3 py-3.5 sm:gap-5 sm:px-5">
          <CompactFilterSelect
            ariaLabel="Location"
            placeholder="Location"
            value={locationFilter}
            onChange={onLocationFilterChange}
            options={locationOptions.map((location) => ({ value: location, label: location }))}
          />
          <CompactFilterSelect
            ariaLabel="Sort by apply date"
            placeholder="Apply date (Newest first)"
            value={sortBy === "newest" || sortBy === "oldest" ? sortBy : ""}
            onChange={(value) => {
              if (value === "newest" || value === "oldest") onSortByChange(value);
            }}
            options={[
              { value: "newest", label: "Apply date (Newest first)" },
              { value: "oldest", label: "Apply date (Oldest first)" },
            ]}
          />
        </div>
      ) : null}

      <div className="flex w-full items-center justify-end border-b border-[#E5E7EB] px-3 py-3 sm:px-5">
        {multiJobToggle}
      </div>
    </>
  );
}
