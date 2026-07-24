"use client";

import { Columns2, Filter, LayoutGrid, List, Search } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { CandidatesSubTabs } from "./CandidatesSubTabs";
import { CandidatesPageHeader } from "./CandidatesPageHeader";
import { ListExportDropdown } from "./ListExportDropdown";
import { ListPaginationControls } from "./ListPaginationControls";
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
  onExportCsv: () => void;
  onExportXls: () => void;
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

export function CandidatesViewToggle({
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

function FiltersToggleButton({
  active,
  hasActiveFilters,
  onClick,
  className = "",
}: {
  active: boolean;
  hasActiveFilters: boolean;
  onClick: () => void;
  className?: string;
}) {
  const isOn = active || hasActiveFilters;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`inline-flex h-10 w-auto shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition sm:h-8 sm:px-3 sm:text-sm ${
        isOn
          ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
          : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
      } ${className}`}
    >
      <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="hidden min-[480px]:inline">Filters</span>
    </button>
  );
}

export function AdvancedSearchButton({
  onClick,
  disabled,
  size = "md",
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const btnH = size === "sm" ? "h-9 sm:h-8" : "h-10 sm:h-9";
  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      disabled={disabled}
      aria-label="Advanced search"
      className={`relative z-10 inline-flex w-auto shrink-0 ${btnH} items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-primary)] px-2.5 text-xs font-semibold whitespace-nowrap text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 max-[429px]:gap-1 max-[429px]:px-2 max-[429px]:text-[10px] sm:px-3 sm:text-sm ${className}`}
    >
      <Search className="h-3.5 w-3.5 shrink-0 max-[429px]:h-3 max-[429px]:w-3 sm:h-4 sm:w-4" />
      <span className="max-[449px]:hidden">Advanced Search</span>
      <span className="hidden max-[449px]:inline">Search</span>
    </button>
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
  onExportCsv,
  onExportXls,
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
    <div className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8">
      <CandidatesSubTabs />

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <CandidatesPageHeader title="Candidates" subtitle="Manage applicants in one place" />

        <div className="flex w-full flex-col overflow-visible rounded-t-[8px] border-y border-[#E5E7EB] bg-white">
          {/* Compact / tablet toolbar — below 1280px */}
          <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-3 py-2.5 xl:hidden">
            <div className="flex w-full items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-[#dce6e3] bg-white px-3 md:h-8">
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
                  className="min-w-0 flex-1 bg-transparent text-base font-normal leading-6 text-[#334155] outline-none placeholder:text-[#94A3B8] sm:text-sm"
                  style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                />
              </div>

              <FiltersToggleButton
                active={showFilterRows}
                hasActiveFilters={hasActiveFilters}
                onClick={onToggleFilterRows}
                className="shrink-0"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="flex items-center gap-1.5 md:hidden">
                  <MobileIconButton onClick={onEditColumns} label="Columns">
                    <Columns2 className="h-4 w-4" />
                  </MobileIconButton>
                  <ListExportDropdown
                    variant="icon"
                    onExportCsv={onExportCsv}
                    onExportXls={onExportXls}
                  />
                  <MobileIconButton onClick={onRefresh} label={refreshLabel}>
                    <BrandedSvgIcon
                      src="/icons/admin-recruiter/candidates/refresh.svg"
                      className="h-4 w-4"
                      color={BRAND_ICON}
                    />
                  </MobileIconButton>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <ToolbarIconButton onClick={onEditColumns} label="Columns">
                    <Columns2 className="h-4 w-4 shrink-0" />
                  </ToolbarIconButton>
                  <ListExportDropdown
                    onExportCsv={onExportCsv}
                    onExportXls={onExportXls}
                  />
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
                <CandidatesViewToggle view={view} onViewChange={onViewChange} size="sm" />
              </div>

              <div className="flex-1 min-[600px]:ml-auto min-[600px]:flex-none">
                <AdvancedSearchButton
                  onClick={onAdvancedSearch}
                  disabled={!onAdvancedSearch}
                  size="sm"
                  className="w-full justify-center min-[600px]:w-auto"
                />
              </div>
            </div>

            {showFilterRows ? (
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5 min-[600px]:grid-cols-2 md:grid-cols-3">
                <CompactFilterField label="Job Role">
                  <select
                    value={jobRoleFilter}
                    onChange={(e) => onJobRoleFilterChange(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155] sm:h-9 appearance-auto cursor-pointer relative z-10"
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
                    className="h-10 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155] sm:h-9 appearance-auto cursor-pointer relative z-10"
                  >
                    <option value="">All</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </CompactFilterField>
                <CompactFilterField label="Date Applied" className="min-[600px]:col-span-2 md:col-span-1">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => onDateFilterChange(e.target.value)}
                    className="h-10 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155] scheme-light sm:h-9"
                  />
                </CompactFilterField>
              </div>
            ) : null}
          </div>

          {/* Desktop toolbar — 1280px and up */}
          <div className="hidden w-full flex-col xl:flex">
            <div className="flex min-h-[52px] w-full items-center gap-2 border-b border-[#E5E7EB] px-[14px] py-2">
              <div className="flex h-8 w-full min-w-0 max-w-[360px] flex-1 items-center rounded-md border border-[#dce6e3] bg-white px-3">
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

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <FiltersToggleButton
                  active={showFilterRows}
                  hasActiveFilters={hasActiveFilters}
                  onClick={onToggleFilterRows}
                  className="[&_span]:inline"
                />
                <ToolbarIconButton onClick={onEditColumns} label="Columns">
                  <Columns2 className="h-4 w-4 shrink-0" />
                </ToolbarIconButton>
                <ListExportDropdown
                  onExportCsv={onExportCsv}
                  onExportXls={onExportXls}
                />
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50"
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
              <div className="flex items-center gap-4 border-b border-[#E5E7EB] px-[14px] py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <BrandedSvgIcon
                    src="/icons/admin-recruiter/candidates/filtered.svg.svg"
                    className="h-4 w-4 shrink-0"
                    color={BRAND_ICON}
                  />
                  <InlineFilterField label="Job Role">
                    <select
                      value={jobRoleFilter}
                      onChange={(e) => onJobRoleFilterChange(e.target.value)}
                      className={`${CANDIDATES_FILTER_CONTROL_CLASS} relative z-10`}
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
                      className={`${CANDIDATES_FILTER_CONTROL_CLASS} relative z-10`}
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
                      className={`${CANDIDATES_FILTER_CONTROL_CLASS} relative z-10 scheme-light`}
                      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                    />
                  </InlineFilterField>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <AdvancedSearchButton
                    onClick={onAdvancedSearch}
                    disabled={!onAdvancedSearch}
                    size="sm"
                  />
                  <CandidatesViewToggle view={view} onViewChange={onViewChange} size="sm" />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 px-3 py-2 xl:flex-row xl:items-center xl:justify-between xl:gap-3 xl:px-[14px] xl:py-3">
          <div className="text-xs leading-4 text-[#5e7371]">{totalText}</div>
          {!showFilterRows ? (
            <div className="hidden shrink-0 items-center gap-2 xl:flex">
              <AdvancedSearchButton
                onClick={onAdvancedSearch}
                disabled={!onAdvancedSearch}
                size="sm"
              />
              <CandidatesViewToggle view={view} onViewChange={onViewChange} size="sm" />
            </div>
          ) : null}
        </div>

        <div className="bg-white px-3 py-4 xl:px-[14px]">{children}</div>

        {totalFiltered > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-white px-3 py-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between xl:gap-4 xl:px-[14px]">
            <p className="text-sm text-[#64748B]">
              Showing {rangeStart}-{rangeEnd} of {totalFiltered} results
            </p>
            <div className="flex w-full flex-wrap items-center justify-end gap-3 xl:w-auto">
              <label className="flex items-center gap-2 text-sm text-[#64748B]">
                Show
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="box-border h-8 rounded-lg border border-[#CBD5E1] bg-white px-2 text-sm text-[#334155] focus:border-[color:var(--brand-primary)] focus:outline-none"
                >
                  {[10, 20, 30].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <ListPaginationControls
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={onPageChange}
                activeStyle={{
                  backgroundColor: "var(--brand-secondary)",
                  borderColor: "var(--brand-secondary)",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
