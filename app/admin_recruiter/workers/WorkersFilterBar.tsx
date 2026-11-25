"use client";

import React, { useState, useEffect } from "react";
import { Search, ChevronDown, Check, LayoutList, SlidersHorizontal, RefreshCw } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  JobsViewToggle,
  type JobsListingView,
} from "@/app/admin_recruiter/jobs/JobsViewToggle";
import {
  BRAAS_PRIMARY,
  readableTextOnBrand,
} from "@/lib/tenant/tenant-branding";

export type WorkersFilterBarProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: () => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  clientFilter: string;
  onClientFilterChange: (client: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  roleOptions: string[];
  clientOptions: string[];
  statusOptions: string[];
  searching?: boolean;
  onRefresh?: () => void;
  onOpenColumns?: () => void;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  viewMode?: JobsListingView;
  onViewModeChange?: (next: JobsListingView) => void;
};

const FILTER_CHIP_CLASS =
  "inline-flex h-8 w-full max-w-none items-center justify-between gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium leading-4 text-[#334155] transition hover:bg-[#F8FAFC] cursor-pointer sm:w-auto sm:justify-start";

export function WorkersFilterBar({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  roleFilter,
  onRoleFilterChange,
  clientFilter,
  onClientFilterChange,
  statusFilter,
  onStatusFilterChange,
  roleOptions = ["All", "IT Project Manager", "Oracle Fusion ERP Admin", "Software Engineer", "Medical Assistant", "Production Supervisor"],
  clientOptions = ["All", "Lennox", "Freddie Mac", "HealthTech", "Nexus Medical"],
  statusOptions = ["All", "Active", "Inactive", "Onboarding"],
  searching = false,
  onRefresh,
  onOpenColumns,
  onOpenFilters,
  activeFilterCount = 0,
  viewMode = "list",
  onViewModeChange,
}: WorkersFilterBarProps) {
  const branding = useTenantBranding();
  const primaryColor = branding.primaryHex || BRAAS_PRIMARY;
  const textOnPrimary = readableTextOnBrand(primaryColor);

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-filter-dropdown]")) {
        setRoleMenuOpen(false);
        setClientMenuOpen(false);
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-center">
        {/* Search — stacks button under input on phones; desktop row unchanged */}
        <div className="flex w-full max-w-[480px] flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-2xs sm:flex-row sm:items-center sm:gap-0 sm:p-1">
          <div className="relative flex min-w-0 flex-1 items-center pl-3">
            <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="Search worker"
              className="w-full min-w-0 bg-transparent px-3 py-1.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onSearch}
            disabled={searching}
            style={{
              backgroundColor: primaryColor,
              color: textOnPrimary,
            }}
            className="h-9 w-full shrink-0 rounded-lg px-4 text-xs font-semibold leading-4 shadow-xs transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60 cursor-pointer sm:h-8 sm:w-auto"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Filter chips — 2-col on phones; wrap row from sm+ (desktop look unchanged) */}
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
          <div className="relative min-w-0" data-filter-dropdown>
            <button
              type="button"
              onClick={() => {
                setRoleMenuOpen(!roleMenuOpen);
                setClientMenuOpen(false);
                setStatusMenuOpen(false);
              }}
              className={`${FILTER_CHIP_CLASS} sm:max-w-[220px]`}
            >
              <span className="truncate">Role • {roleFilter || "All IT"}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
            </button>
            {roleMenuOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:w-60">
                {roleOptions.map((opt) => {
                  const isAll = opt === "All" || opt === "All IT";
                  const isSelected = roleFilter ? roleFilter === opt : isAll;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onRoleFilterChange(isAll ? "" : opt);
                        setRoleMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <span className="truncate pr-2">{opt}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative min-w-0" data-filter-dropdown>
            <button
              type="button"
              onClick={() => {
                setClientMenuOpen(!clientMenuOpen);
                setRoleMenuOpen(false);
                setStatusMenuOpen(false);
              }}
              className={`${FILTER_CHIP_CLASS} sm:max-w-[200px]`}
            >
              <span className="truncate">Client • {clientFilter || "All"}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
            </button>
            {clientMenuOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:w-52">
                {clientOptions.map((opt) => {
                  const isAll = opt === "All";
                  const isSelected = clientFilter ? clientFilter === opt : isAll;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onClientFilterChange(isAll ? "" : opt);
                        setClientMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <span className="truncate pr-2">{opt}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative min-w-0 col-span-2 sm:col-span-1" data-filter-dropdown>
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen(!statusMenuOpen);
                setRoleMenuOpen(false);
                setClientMenuOpen(false);
              }}
              className={FILTER_CHIP_CLASS}
            >
              <span className="truncate">Status • {statusFilter || "All"}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
            </button>
            {statusMenuOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:w-44">
                {statusOptions.map((opt) => {
                  const isAll = opt === "All";
                  const isSelected = statusFilter ? statusFilter === opt : isAll;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onStatusFilterChange(isAll ? "" : opt);
                        setStatusMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <span>{opt}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tools left; list/grid toggle on the right (user-marked area) */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {onOpenColumns && (
            <button
              type="button"
              onClick={onOpenColumns}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] shadow-2xs hover:bg-[#F8FAFC] cursor-pointer transition"
              title="Edit Columns"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          )}
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] shadow-2xs hover:bg-[#F8FAFC] cursor-pointer transition"
              title="All Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span
                  style={{ backgroundColor: primaryColor }}
                  className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs"
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] shadow-2xs hover:bg-[#F8FAFC] cursor-pointer transition"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {onViewModeChange ? (
          <JobsViewToggle value={viewMode} onChange={onViewModeChange} />
        ) : null}
      </div>
    </div>
  );
}
