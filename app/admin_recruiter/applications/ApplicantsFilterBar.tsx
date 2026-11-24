"use client";

/* eslint-disable @next/next/no-img-element -- Figma SVGs keep their own width and height. */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  BRAAS_PRIMARY,
  BRAAS_SECONDARY,
  readableTextOnBrand,
} from "@/lib/tenant/tenant-branding";

const VIEW_MODE_INACTIVE_ICON = "#94A3B8";

function ViewModeToggle({
  viewMode,
  primaryColor,
  onViewModeChange,
  className = "",
}: {
  viewMode: "table" | "grid";
  primaryColor: string;
  onViewModeChange: (mode: "table" | "grid") => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onViewModeChange("table")}
        style={viewMode === "table" ? { borderColor: primaryColor } : undefined}
        className={`inline-flex size-8 items-center justify-center rounded-lg bg-white transition hover:bg-[#F8FAFC] ${
          viewMode === "table" ? "border" : "border border-transparent"
        }`}
        title="Table view"
        aria-label="Table view"
        aria-pressed={viewMode === "table"}
      >
        <BrandedSvgIcon
          src="/icons/applicants/icon-list.svg"
          className="h-4 w-4"
          color={viewMode === "table" ? primaryColor : VIEW_MODE_INACTIVE_ICON}
        />
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange("grid")}
        style={viewMode === "grid" ? { borderColor: primaryColor } : undefined}
        className={`inline-flex size-8 items-center justify-center rounded-lg bg-white transition hover:bg-[#F8FAFC] ${
          viewMode === "grid" ? "border" : "border border-transparent"
        }`}
        title="Grid view"
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <BrandedSvgIcon
          src="/icons/applicants/icon-grid.svg"
          className="h-4 w-4"
          color={viewMode === "grid" ? primaryColor : VIEW_MODE_INACTIVE_ICON}
        />
      </button>
    </div>
  );
}

export type ApplicantsFilterBarProps = {
  applicantQuery: string;
  onApplicantQueryChange: (query: string) => void;
  keywordQuery: string;
  onKeywordQueryChange: (keywords: string) => void;
  onSearch: () => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  clientFilter: string;
  onClientFilterChange: (client: string) => void;
  matchFilter: string;
  onMatchFilterChange: (match: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (owner: string) => void;
  highlightMultiJob: boolean;
  onHighlightMultiJobChange: (val: boolean) => void;
  onAddApplicant: () => void;
  onMatchToJob: () => void;
  onOpenAllFilters?: () => void;
  onEditColumns?: () => void;
  activeFilterCount?: number;
  viewMode: "table" | "grid";
  onViewModeChange: (mode: "table" | "grid") => void;
  searching?: boolean;
  roleOptions?: string[];
  clientOptions?: string[];
  ownerOptions?: string[];
  matchOptions?: string[];
};

type FilterMenuId = "role" | "client" | "match" | "owner";

const VIEWPORT_PAD = 8;
const MENU_GAP = 6;
const MENU_ESTIMATED_HEIGHT = 256;

function isAllOption(opt: string, kind: FilterMenuId): boolean {
  if (opt === "All") return true;
  if (kind === "role") return opt === "All Roles" || opt === "All IT";
  if (kind === "owner") return opt === "All Recruiters";
  return false;
}

function FilterMenuPortal({
  anchor,
  width,
  accentColor,
  options,
  selectedValue,
  kind,
  onClose,
  onSelect,
}: {
  anchor: HTMLElement;
  width: number;
  accentColor: string;
  options: string[];
  selectedValue: string;
  kind: FilterMenuId;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    const menuWidth = Math.min(width, window.innerWidth - VIEWPORT_PAD * 2);
    const measuredHeight = menuRef.current?.offsetHeight || MENU_ESTIMATED_HEIGHT;

    let left = rect.left;
    if (left + menuWidth > window.innerWidth - VIEWPORT_PAD) {
      left = rect.right - menuWidth;
    }
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PAD));

    let top = rect.bottom + MENU_GAP;
    if (top + measuredHeight > window.innerHeight - VIEWPORT_PAD) {
      const above = rect.top - measuredHeight - MENU_GAP;
      top = above >= VIEWPORT_PAD ? above : Math.max(VIEWPORT_PAD, window.innerHeight - measuredHeight - VIEWPORT_PAD);
    }

    setStyle({
      position: "fixed",
      top,
      left,
      width: menuWidth,
      visibility: "visible",
    });
  }, [anchor, width]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchor, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      data-filter-dropdown-menu=""
      style={style}
      className="z-[220] max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg"
    >
      {options.map((opt) => {
        const all = isAllOption(opt, kind);
        const isSelected = selectedValue ? selectedValue === opt : all;
        return (
          <button
            key={opt}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onSelect(all ? "" : opt);
              onClose();
            }}
            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs text-[#334155] hover:bg-[#F8FAFC]"
          >
            <span className="min-w-0 truncate pr-2">{opt}</span>
            {isSelected ? (
              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
            ) : null}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  open,
  menuWidth,
  accentColor,
  buttonClassName,
  onOpen,
  onClose,
  onChange,
}: {
  id: FilterMenuId;
  label: string;
  value: string;
  options: string[];
  open: boolean;
  menuWidth: number;
  accentColor: string;
  buttonClassName: string;
  onOpen: () => void;
  onClose: () => void;
  onChange: (next: string) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative min-w-0 w-full sm:w-auto" data-filter-dropdown={id}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) onClose();
          else onOpen();
        }}
        className={buttonClassName}
      >
        <span className="truncate">
          {label} • {value || "All"}
        </span>
        <img src="/icons/applicants/icon-chevron-down.svg" alt="" className="shrink-0" />
      </button>
      {open && buttonRef.current ? (
        <FilterMenuPortal
          anchor={buttonRef.current}
          width={menuWidth}
          accentColor={accentColor}
          options={options}
          selectedValue={value}
          kind={id}
          onClose={onClose}
          onSelect={onChange}
        />
      ) : null}
    </div>
  );
}

export function ApplicantsFilterBar({
  applicantQuery,
  onApplicantQueryChange,
  keywordQuery,
  onKeywordQueryChange,
  onSearch,
  roleFilter,
  onRoleFilterChange,
  clientFilter,
  onClientFilterChange,
  matchFilter,
  onMatchFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  highlightMultiJob,
  onHighlightMultiJobChange,
  onAddApplicant,
  onMatchToJob,
  onOpenAllFilters,
  onEditColumns,
  activeFilterCount = 0,
  viewMode,
  onViewModeChange,
  searching = false,
  roleOptions = ["All", "IT Project Manager", "Software Engineer", "ERP Admin", "QA Analyst", "Data Analyst"],
  clientOptions = ["All", "ZippyCorp", "HealthTech", "Nexus Medical", "Apex Systems"],
  ownerOptions = ["All", "Me", "Unassigned"],
  matchOptions = ["All", "Strong", "Review", "Not Match"],
}: ApplicantsFilterBarProps) {
  const branding = useTenantBranding();
  const primaryColor = branding.primaryHex || BRAAS_PRIMARY;
  const secondaryColor = branding.secondaryHex || BRAAS_SECONDARY || "#012352";
  const textOnPrimary = readableTextOnBrand(primaryColor);

  const [openMenu, setOpenMenu] = useState<FilterMenuId | null>(null);

  const closeMenus = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.("[data-filter-dropdown]") ||
        target?.closest?.("[data-filter-dropdown-menu]")
      ) {
        return;
      }
      setOpenMenu(null);
    }
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  const chipClass =
    "inline-flex h-8 max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium leading-4 text-[#334155] transition hover:bg-[#F8FAFC]";

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex w-full max-w-[750px] flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white p-1.5 sm:flex-row sm:items-center sm:gap-0 sm:p-1">
          <div className="relative flex min-w-0 flex-1 items-center pl-2 sm:pl-3">
            <img src="/icons/applicants/icon-search.svg" alt="" className="shrink-0" />
            <input
              type="text"
              value={applicantQuery}
              onChange={(e) => onApplicantQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="Search applicant"
              className="w-full min-w-0 bg-transparent px-3 py-1.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
            />
          </div>

          <div className="mx-1 hidden h-6 w-px shrink-0 bg-[#E2E8F0] sm:block" />
          <div className="mx-2 h-px bg-[#E2E8F0] sm:hidden" />

          <div className="flex min-w-0 flex-1 items-center px-2">
            <input
              type="text"
              value={keywordQuery}
              onChange={(e) => onKeywordQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="Search keywords"
              className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
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
            className="h-9 w-full shrink-0 rounded-lg px-4 text-xs font-semibold leading-4 shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60 sm:h-8 sm:w-auto"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Dropdown Filters — 2-col grid on phones; wrap row from sm+ */}
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
          <FilterSelect
            id="role"
            label="Role"
            value={roleFilter}
            options={roleOptions}
            open={openMenu === "role"}
            menuWidth={240}
            accentColor={primaryColor}
            buttonClassName={`${chipClass} w-full max-w-none justify-between sm:w-auto sm:max-w-[220px] sm:justify-start`}
            onOpen={() => setOpenMenu("role")}
            onClose={closeMenus}
            onChange={onRoleFilterChange}
          />
          <FilterSelect
            id="client"
            label="Client"
            value={clientFilter}
            options={clientOptions}
            open={openMenu === "client"}
            menuWidth={208}
            accentColor={primaryColor}
            buttonClassName={`${chipClass} w-full max-w-none justify-between sm:w-auto sm:max-w-[200px] sm:justify-start`}
            onOpen={() => setOpenMenu("client")}
            onClose={closeMenus}
            onChange={onClientFilterChange}
          />
          <FilterSelect
            id="match"
            label="Match"
            value={matchFilter}
            options={matchOptions}
            open={openMenu === "match"}
            menuWidth={176}
            accentColor={primaryColor}
            buttonClassName={`${chipClass} w-full max-w-none justify-between sm:w-auto sm:max-w-none sm:justify-start`}
            onOpen={() => setOpenMenu("match")}
            onClose={closeMenus}
            onChange={onMatchFilterChange}
          />
          <FilterSelect
            id="owner"
            label="Owner"
            value={ownerFilter}
            options={ownerOptions}
            open={openMenu === "owner"}
            menuWidth={192}
            accentColor={primaryColor}
            buttonClassName={`${chipClass} w-full max-w-none justify-between sm:w-auto sm:max-w-[200px] sm:justify-start`}
            onOpen={() => setOpenMenu("owner")}
            onClose={closeMenus}
            onChange={onOwnerFilterChange}
          />
        </div>
      </div>

      {/* Toolbar / Actions Row
          Mobile: tools ↔ view toggles on one row; Add / Match full-width below
          Desktop (sm+): original left tools + right actions row */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEditColumns}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-[#F8FAFC]"
              title="Columns view"
              aria-label="Columns view"
            >
              <img src="/icons/applicants/icon-columns.svg" alt="" />
            </button>
            <button
              type="button"
              onClick={onOpenAllFilters}
              className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-[#F8FAFC]"
              title="All Filters"
              aria-label="All Filters"
            >
              <img src="/icons/applicants/icon-filters.svg" alt="" />
              {activeFilterCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                  style={{ backgroundColor: primaryColor, color: textOnPrimary }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <ViewModeToggle
            className="sm:hidden"
            viewMode={viewMode}
            primaryColor={primaryColor}
            onViewModeChange={onViewModeChange}
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
          <button
            type="button"
            onClick={onAddApplicant}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-semibold leading-4 text-[#475569] transition hover:bg-[#F8FAFC] active:scale-[0.98] sm:h-8 sm:w-auto"
          >
            <img src="/icons/applicants/icon-add-applicant.svg" alt="" />
            <span>Add Applicant</span>
          </button>

          <button
            type="button"
            onClick={onMatchToJob}
            style={{
              backgroundColor: primaryColor,
              color: textOnPrimary,
            }}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold leading-4 transition hover:brightness-95 active:scale-[0.98] sm:h-8 sm:w-auto"
          >
            <img src="/icons/applicants/icon-match-job.svg" alt="" />
            <span>Match to a job</span>
          </button>

          <ViewModeToggle
            className="hidden sm:flex"
            viewMode={viewMode}
            primaryColor={primaryColor}
            onViewModeChange={onViewModeChange}
          />
        </div>
      </div>

      <label className="flex cursor-pointer select-none items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={highlightMultiJob}
          onClick={() => onHighlightMultiJobChange(!highlightMultiJob)}
          style={highlightMultiJob ? { backgroundColor: secondaryColor } : undefined}
          className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
            highlightMultiJob ? "" : "bg-[#CBD5E1]"
          }`}
        >
          <span
            className={`pointer-events-none mt-1 inline-block size-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              highlightMultiJob ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-xs font-normal leading-4 text-[#374151]">
          Highlight Multi-Job Applicants
        </span>
      </label>
    </div>
  );
}
