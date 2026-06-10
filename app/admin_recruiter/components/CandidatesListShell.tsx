"use client";

import { useMemo } from "react";
import { Columns2, Download, Filter, LayoutGrid, List, Plus } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { CandidatesSubTabs } from "./CandidatesSubTabs";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "../candidates/candidates-typography";

const BRAND_ICON = "var(--brand-primary)";

export type CandidatesListShellProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  refreshLabel?: string;
  showFilterRows: boolean;
  onToggleFilterRows: () => void;
  jobRoleFilter: string;
  onJobRoleFilterChange: (value: string) => void;
  locationFilter: string;
  onLocationFilterChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  jobRoleOptions: string[];
  locationOptions: string[];
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
  onEditColumns: () => void;
  onExport: () => void;
  onAdvancedSearch?: () => void;
  totalCount: number | null;
  loading: boolean;
  totalLabel: string;
  advancedSearchActive?: boolean;
  advancedSearchPlace?: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalFiltered: number;
  children: React.ReactNode;
};

function viewToggleClass(active: boolean): string {
  return active
    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
    : "border-[#dce6e3] bg-white text-[#64748B] hover:bg-zinc-50";
}

function InlineFilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
        {label}
      </span>
      {children}
    </label>
  );
}

function CreateAndViewActions({
  view,
  onViewChange,
  size = "md",
}: {
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
  size?: "md" | "sm";
}) {
  const btnH = size === "sm" ? "h-8" : "h-9";
  const iconBtn = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        className={`inline-flex ${btnH} items-center gap-1.5 whitespace-nowrap rounded-md bg-[color:var(--brand-primary)] px-3 text-sm font-semibold leading-6 text-white transition hover:brightness-95`}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        Create Candidate
      </button>
      <button
        type="button"
        onClick={() => onViewChange("card")}
        aria-label="Card view"
        className={`inline-flex ${iconBtn} shrink-0 items-center justify-center rounded-md border transition ${viewToggleClass(view === "card")}`}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("list")}
        aria-label="List view"
        className={`inline-flex ${iconBtn} shrink-0 items-center justify-center rounded-md border transition ${viewToggleClass(view === "list")}`}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

export function CandidatesListShell({
  query,
  onQueryChange,
  onRefresh,
  refreshLabel = "Refresh",
  showFilterRows,
  onToggleFilterRows,
  jobRoleFilter,
  onJobRoleFilterChange,
  locationFilter,
  onLocationFilterChange,
  dateFilter,
  onDateFilterChange,
  jobRoleOptions,
  locationOptions,
  view,
  onViewChange,
  onEditColumns,
  onExport,
  onAdvancedSearch,
  totalCount,
  loading,
  totalLabel,
  advancedSearchActive,
  advancedSearchPlace,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalFiltered,
  children,
}: CandidatesListShellProps) {
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalFiltered);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(safePage - 2, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  }, [safePage, totalPages]);

  const totalText = advancedSearchActive ? (
    <>
      Total:{" "}
      <span className="font-semibold text-[#203130]">{loading ? "—" : totalCount ?? totalFiltered}</span>{" "}
      Results
      {advancedSearchPlace ? (
        <>
          {" "}
          found in <span className="font-semibold text-[#203130]">{advancedSearchPlace}</span>
        </>
      ) : null}
    </>
  ) : (
    <>
      Total:{" "}
      <span className="font-semibold text-[#203130]">{loading ? "—" : totalCount ?? totalFiltered}</span>{" "}
      {loading ? "" : totalLabel}
    </>
  );

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <CandidatesSubTabs />

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <div className="px-[14px] pb-4 pt-5">
          <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
            Candidates
          </h1>
          <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
            Manage applicants in one place
          </p>
        </div>

        <div
          className={`flex w-full flex-col gap-0 overflow-hidden rounded-t-[8px] border-y border-[#E5E7EB] bg-white ${
            showFilterRows ? "min-h-[104px]" : "min-h-[52px]"
          }`}
        >
          <div className="flex h-[52px] w-full shrink-0 items-center gap-3 border-b border-[#E5E7EB] px-[14px]">
            <div className="flex h-8 w-full min-w-0 max-w-[360px] items-center rounded-md border border-[#dce6e3] bg-white px-3">
              <BrandedSvgIcon
                src="/icons/admin-recruiter/candidates/search.svg"
                className="mr-2 h-4 w-4 shrink-0"
                color={BRAND_ICON}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search workers"
                className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-6 text-[#334155] outline-none placeholder:text-[#94A3B8]"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              />
            </div>

            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onToggleFilterRows}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Filter className="h-4 w-4 shrink-0" />
                Filters
              </button>
              <button
                type="button"
                onClick={onEditColumns}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Columns2 className="h-4 w-4 shrink-0" />
                Columns
              </button>
              <button
                type="button"
                onClick={onExport}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Download className="h-4 w-4 shrink-0" />
                Export
              </button>
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-2.5 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                aria-label={refreshLabel}
                title={refreshLabel}
              >
                <BrandedSvgIcon
                  src="/icons/admin-recruiter/candidates/refresh.svg"
                  className="h-4 w-4 shrink-0"
                  color={BRAND_ICON}
                />
              </button>
              {onAdvancedSearch ? (
                <button
                  type="button"
                  onClick={onAdvancedSearch}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#dce6e3] bg-white transition hover:bg-zinc-50"
                  aria-label="Advanced search"
                >
                  <BrandedSvgIcon
                    src="/icons/admin-recruiter/candidates/three-dot.svg"
                    className="h-4 w-4"
                    color={BRAND_ICON}
                  />
                </button>
              ) : null}
            </div>
          </div>

          {showFilterRows ? (
            <div className="flex h-[52px] w-full shrink-0 items-center gap-3 px-[14px]">
              <div className="flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <BrandedSvgIcon
                  src="/icons/admin-recruiter/candidates/filtered.svg.svg"
                  className="h-4 w-4 shrink-0"
                  color={BRAND_ICON}
                />
                <InlineFilterField label="Job Role">
                  <select
                    value={jobRoleFilter}
                    onChange={(e) => onJobRoleFilterChange(e.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    {jobRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </InlineFilterField>
                <InlineFilterField label="Location">
                  <select
                    value={locationFilter}
                    onChange={(e) => onLocationFilterChange(e.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </InlineFilterField>
                <InlineFilterField label="Date Applied">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => onDateFilterChange(e.target.value)}
                    className={`${CANDIDATES_FILTER_CONTROL_CLASS} min-w-[132px] scheme-light`}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  />
                </InlineFilterField>
              </div>

              <div className="ml-auto shrink-0 pl-3">
                <CreateAndViewActions view={view} onViewChange={onViewChange} size="sm" />
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={`flex w-full items-center gap-3 px-[14px] py-3 ${
            showFilterRows ? "" : "justify-between"
          }`}
        >
          <div className="text-xs leading-4 text-[#5e7371]">{totalText}</div>
          {!showFilterRows ? (
            <div className="ml-auto shrink-0">
              <CreateAndViewActions view={view} onViewChange={onViewChange} />
            </div>
          ) : null}
        </div>

        <div className="bg-white px-[14px] py-4">{children}</div>

        {totalFiltered > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E7EB] bg-white px-[14px] py-4">
            <p className="text-sm text-[#64748B]">
              Showing {rangeStart}-{rangeEnd} of {totalFiltered} results
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[#64748B]">
                Show
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-9 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155] focus:border-[color:var(--brand-primary)] focus:outline-none"
                >
                  {[10, 20, 30].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => onPageChange(safePage - 1)}
                  className="h-9 rounded-md border border-[#dce6e3] bg-white px-3 text-sm text-[#334155] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                {pageNumbers.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => onPageChange(num)}
                    className={`h-9 min-w-9 rounded-md border px-3 text-sm transition ${
                      num === safePage
                        ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)] text-white"
                        : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => onPageChange(safePage + 1)}
                  className="h-9 rounded-md border border-[#dce6e3] bg-white px-3 text-sm text-[#334155] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
