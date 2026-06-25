"use client";

import { useMemo } from "react";
import { Columns2, Download, Filter, LayoutGrid, List, Search } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { CandidatesSubTabs } from "./CandidatesSubTabs";
import { CandidatesPageHeader } from "./CandidatesPageHeader";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
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
    <label className="flex w-full min-w-0 shrink-0 flex-col gap-1 lg:w-auto lg:flex-row lg:items-center lg:gap-2">
      <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
        {label}
      </span>
      {children}
    </label>
  );
}

function MobileIconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

function ToolbarIconButton({
  onClick,
  label,
  children,
  className = "",
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50 ${className}`}
      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function CompactFilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium leading-4 text-[#475569]">{label}</span>
      {children}
    </label>
  );
}

function ViewToggleButtons({
  view,
  onViewChange,
  size = "md",
}: {
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
  size?: "md" | "sm";
}) {
  const iconBtn = size === "sm" ? "h-9 w-9" : "h-10 w-10 sm:h-9 sm:w-9";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onViewChange("card")}
        aria-label="Card view"
        className={`inline-flex ${iconBtn} items-center justify-center rounded-md border transition ${viewToggleClass(view === "card")}`}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onViewChange("list")}
        aria-label="List view"
        className={`inline-flex ${iconBtn} items-center justify-center rounded-md border transition ${viewToggleClass(view === "list")}`}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

function CreateAndViewActions({
  view,
  onViewChange,
  onAdvancedSearch,
  size = "md",
  showViewToggle = true,
}: {
  view: "card" | "list";
  onViewChange: (view: "card" | "list") => void;
  onAdvancedSearch?: () => void;
  size?: "md" | "sm";
  showViewToggle?: boolean;
}) {
  const btnH = size === "sm" ? "h-9 sm:h-8" : "h-10 sm:h-9";

  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto sm:shrink-0">
      {showViewToggle ? <ViewToggleButtons view={view} onViewChange={onViewChange} size={size} /> : null}
      <button
        type="button"
        onClick={onAdvancedSearch}
        disabled={!onAdvancedSearch}
        aria-label="Advanced search"
        className={`inline-flex w-auto shrink-0 ${btnH} items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[color:var(--brand-primary)] px-3 text-sm font-semibold leading-6 text-white transition hover:brightness-95`}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Advanced Search</span>
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
  const hasActiveFilters = Boolean(jobRoleFilter || locationFilter || dateFilter);

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
    <div className="px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8">
      <CandidatesSubTabs />

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <CandidatesPageHeader title="Candidates" subtitle="Manage applicants in one place" />

        <div className="flex w-full flex-col overflow-hidden rounded-t-[8px] border-y border-[#E5E7EB] bg-white">
          {/* Compact toolbar — phones & tablets up to ~1023px (fixes ~679px overlap) */}
          <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-3 py-2.5 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-[#dce6e3] bg-white px-3">
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

              <button
                type="button"
                onClick={onToggleFilterRows}
                aria-expanded={showFilterRows}
                className={`inline-flex h-10 w-auto shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition ${
                  showFilterRows || hasActiveFilters
                    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
                    : "border-[#dce6e3] bg-white text-[#334155]"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <MobileIconButton onClick={onEditColumns} label="Columns">
                <Columns2 className="h-4 w-4" />
              </MobileIconButton>
              <MobileIconButton onClick={onExport} label="Export">
                <Download className="h-4 w-4" />
              </MobileIconButton>
              <MobileIconButton onClick={onRefresh} label={refreshLabel}>
                <BrandedSvgIcon
                  src="/icons/admin-recruiter/candidates/refresh.svg"
                  className="h-4 w-4"
                  color={BRAND_ICON}
                />
              </MobileIconButton>

              <ViewToggleButtons view={view} onViewChange={onViewChange} size="sm" />

              <button
                type="button"
                onClick={() => onAdvancedSearch?.()}
                aria-label="Advanced search"
                className="relative z-10 ml-auto inline-flex h-9 w-auto shrink-0 items-center justify-center gap-1 rounded-md bg-[color:var(--brand-primary)] px-2.5 text-xs font-semibold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!onAdvancedSearch}
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">Advanced Search</span>
              </button>
            </div>

            {showFilterRows ? (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5">
                <CompactFilterField label="Job Role">
                  <select
                    value={jobRoleFilter}
                    onChange={(e) => onJobRoleFilterChange(e.target.value)}
                    className="h-9 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155]"
                  >
                    <option value="">All</option>
                    {jobRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </CompactFilterField>
                <CompactFilterField label="Location">
                  <select
                    value={locationFilter}
                    onChange={(e) => onLocationFilterChange(e.target.value)}
                    className="h-9 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155]"
                  >
                    <option value="">All</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </CompactFilterField>
                <CompactFilterField label="Date Applied" className="col-span-2">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => onDateFilterChange(e.target.value)}
                    className="h-9 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155] scheme-light"
                  />
                </CompactFilterField>
              </div>
            ) : null}
          </div>

          {/* Desktop toolbar — wide screens only */}
          <div className="hidden w-full flex-col lg:flex">
            <div className="flex min-h-[52px] w-full shrink-0 flex-wrap items-center gap-2 border-b border-[#E5E7EB] px-[14px] py-2 xl:flex-nowrap xl:py-0">
              <div className="flex h-8 w-full min-w-[200px] flex-1 items-center rounded-md border border-[#dce6e3] bg-white px-3 xl:max-w-[360px]">
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

              <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 xl:ml-auto xl:w-auto">
                <ToolbarIconButton onClick={onToggleFilterRows} label="Filters">
                  <Filter className="h-4 w-4 shrink-0" />
                </ToolbarIconButton>
                <ToolbarIconButton onClick={onEditColumns} label="Columns">
                  <Columns2 className="h-4 w-4 shrink-0" />
                </ToolbarIconButton>
                <ToolbarIconButton onClick={onExport} label="Export">
                  <Download className="h-4 w-4 shrink-0" />
                </ToolbarIconButton>
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
              </div>
            </div>

            {showFilterRows ? (
              <div className="flex w-full flex-col gap-2 border-b border-[#E5E7EB] px-[14px] py-2.5 xl:flex-row xl:items-center xl:gap-3 xl:py-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 xl:flex-nowrap xl:overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <BrandedSvgIcon
                    src="/icons/admin-recruiter/candidates/filtered.svg.svg"
                    className="hidden h-4 w-4 shrink-0 xl:block"
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
                      className={`${CANDIDATES_FILTER_CONTROL_CLASS} scheme-light`}
                      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                    />
                  </InlineFilterField>
                </div>

                <div className="w-full shrink-0 xl:ml-auto xl:w-auto xl:pl-3">
                  <CreateAndViewActions
                    view={view}
                    onViewChange={onViewChange}
                    onAdvancedSearch={onAdvancedSearch}
                    size="sm"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`flex w-full flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:gap-3 lg:px-[14px] lg:py-3 ${
            showFilterRows ? "" : "lg:justify-between"
          }`}
        >
          <div className="text-xs leading-4 text-[#5e7371]">{totalText}</div>
          {!showFilterRows ? (
            <div className="hidden w-full shrink-0 lg:ml-auto lg:block lg:w-auto">
              <CreateAndViewActions
                view={view}
                onViewChange={onViewChange}
                onAdvancedSearch={onAdvancedSearch}
              />
            </div>
          ) : null}
        </div>

        <div className="bg-white px-3 py-4 lg:px-[14px]">{children}</div>

        {totalFiltered > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-white px-3 py-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4 lg:px-[14px]">
            <p className="text-sm text-[#64748B]">
              Showing {rangeStart}-{rangeEnd} of {totalFiltered} results
            </p>
            <div className="flex w-full flex-wrap items-center justify-end gap-3 lg:w-auto">
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
