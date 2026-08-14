"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Plus, Download, ChevronDown } from "lucide-react";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import { BulkDeleteConfirmModal } from "@/app/admin_recruiter/components/BulkDeleteConfirmModal";
import { BulkDeleteToolbarButton } from "@/app/admin_recruiter/components/BulkDeleteToolbarButton";
import { ListExportDropdown } from "@/app/admin_recruiter/components/ListExportDropdown";
import { ListPaginationControls, ListPaginationShowLabel } from "@/app/admin_recruiter/components/ListPaginationControls";
import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";
import { useCandidatesFilterRowsDefault } from "@/app/admin_recruiter/hooks/useCandidatesFilterRowsDefault";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import toast from "react-hot-toast";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import {
  EditJobsFiltersModal,
  EMPTY_JOBS_EXTENDED_FILTERS,
  jobMatchesDatePostedFilter,
  jobMatchesPayRateFilter,
  type JobsExtendedFilterValues,
} from "./EditJobsFiltersModal";
import {
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
  CANDIDATES_PAGE_SUBTITLE_CLASS,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing";
import {
  DEFAULT_JOB_COLUMNS,
  JOB_COLUMN_OPTIONS,
  jobColumnLabel,
  jobListColumnClassName,
  isSortableJobColumn,
  isCenterAlignedJobColumn,
  loadJobColumnOrder,
  saveJobColumnOrder,
  type JobColumnId,
  type JobSortField,
} from "./job-columns";
import { exportJobsCsv, exportJobsXls } from "./export-jobs";
import { JobsGridView } from "./JobsGridView";
import { JobsViewToggle, type JobsListingView } from "./JobsViewToggle";
import {
  jobContractGroup,
  jobListDisplayTitle,
  jobLocation,
  jobPlacementType,
  jobProfession,
  jobShiftType,
  jobSortValue,
  renderJobListCell,
  type JobListCellContext,
  type JobListRow,
} from "./render-job-list-cell";

function relationNameFromJob(
  value: JobListRow["professions"] | JobListRow["specialties"] | JobListRow["onboarding_flows"]
): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() || "";
}

type JobTab = "all" | "internal" | "msp" | "draft" | "open" | "closed" | "archived" | "hot";

/** Figma jobs listing tabs */
const JOB_TABS: Array<{ id: JobTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "internal", label: "Internal" },
  { id: "msp", label: "MSP" },
  { id: "draft", label: "Draft" },
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
  { id: "archived", label: "Archived" },
  { id: "hot", label: "Hot Jobs" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Figma form fields: 8px radius, #CBD5E1 border, white background */
const JOBS_FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white";

const JOBS_TOOLBAR_BUTTON_CLASS = `${JOBS_FORM_SURFACE_CLASS} inline-flex h-8 items-center gap-1.5 px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50`;

const JOBS_POST_JOB_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-normal leading-5 text-[#525252] transition hover:bg-zinc-50";

const JOBS_BULK_PRIMARY_BUTTON_CLASS =
  "inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";

const JOBS_STAR_FILLED_SRC = "/icons/jobs-icons/Star-filled.svg";
const JOBS_STAR_DEFAULT_SRC = "/icons/jobs-icons/Star-default.svg";
const JOBS_STARRED_STORAGE_KEY = "adminRecruiterJobsStarredIds";
const JOBS_VIEW_STORAGE_KEY = "adminRecruiterJobsView";
const JOB_SORT_ICON_SRC = "/sort-icon.svg";

function loadStarredJobIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(JOBS_STARRED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0));
  } catch {
    return new Set();
  }
}

function loadJobsListingView(): JobsListingView {
  if (typeof window === "undefined") return "list";
  try {
    const raw = localStorage.getItem(JOBS_VIEW_STORAGE_KEY);
    return raw === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function saveJobsListingView(view: JobsListingView) {
  try {
    localStorage.setItem(JOBS_VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}

function saveStarredJobIds(ids: Set<string>) {
  try {
    localStorage.setItem(JOBS_STARRED_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

function JobsFilterIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M6.66667 12H9.33333V10.6667H6.66667V12ZM2 4V5.33333H14V4H2ZM4 8.66667H12V7.33333H4V8.66667Z"
        fill="currentColor"
      />
    </svg>
  );
}

function JobsColumnsIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M2.66667 7C2.11334 7 1.66667 7.44667 1.66667 8C1.66667 8.55333 2.11334 9 2.66667 9C3.22 9 3.66667 8.55333 3.66667 8C3.66667 7.44667 3.22 7 2.66667 7ZM2.66667 3C2.11334 3 1.66667 3.44667 1.66667 4C1.66667 4.55333 2.11334 5 2.66667 5C3.22 5 3.66667 4.55333 3.66667 4C3.66667 3.44667 3.22 3 2.66667 3ZM2.66667 11C2.11334 11 1.66667 11.4533 1.66667 12C1.66667 12.5467 2.12001 13 2.66667 13C3.21334 13 3.66667 12.5467 3.66667 12C3.66667 11.4533 3.22 11 2.66667 11ZM4.66667 12.6667H14V11.3333H4.66667V12.6667ZM4.66667 8.66667H14V7.33333H4.66667V8.66667ZM4.66667 3.33333V4.66667H14V3.33333H4.66667Z"
        fill="currentColor"
      />
    </svg>
  );
}

type SortDirection = "asc" | "desc";

function JobTableSortHeader({
  colId,
  sortField,
  sortDirection,
  onToggleSort,
}: {
  colId: JobSortField;
  sortField: JobSortField | null;
  sortDirection: SortDirection;
  onToggleSort: (field: JobSortField) => void;
}) {
  const isActive = sortField === colId;
  const centered = isCenterAlignedJobColumn(colId);

  return (
    <button
      type="button"
      onClick={() => onToggleSort(colId)}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium normal-case tracking-normal text-black transition hover:opacity-80 ${
        centered ? "w-full justify-center" : ""
      }`}
      aria-label={`Sort by ${jobColumnLabel(colId)}${
        isActive ? `, ${sortDirection === "asc" ? "ascending" : "descending"}` : ""
      }`}
    >
      <span className="whitespace-nowrap">{jobColumnLabel(colId)}</span>
      <img src={JOB_SORT_ICON_SRC} width={12} height={12} className="h-3 w-3 shrink-0" alt="" aria-hidden />
    </button>
  );
}

/** Custom horizontal scrollbar so hover can use cursor:pointer (native bars force the arrow). */
function JobsListScrollArea({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbWidthRef = useRef(0);
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const [scrollState, setScrollState] = useState({
    canScroll: false,
    thumbWidth: 0,
    thumbLeft: 0,
  });

  const syncThumb = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { scrollWidth, clientWidth, scrollLeft } = viewport;
    const canScroll = scrollWidth > clientWidth + 1;
    if (!canScroll) {
      thumbWidthRef.current = 0;
      setScrollState((prev) =>
        prev.canScroll || prev.thumbWidth || prev.thumbLeft
          ? { canScroll: false, thumbWidth: 0, thumbLeft: 0 }
          : prev
      );
      return;
    }
    const ratio = clientWidth / scrollWidth;
    const thumbWidth = Math.max(40, clientWidth * ratio);
    const maxThumbLeft = clientWidth - thumbWidth;
    const maxScrollLeft = scrollWidth - clientWidth;
    const thumbLeft =
      maxScrollLeft <= 0 ? 0 : (scrollLeft / maxScrollLeft) * maxThumbLeft;
    thumbWidthRef.current = thumbWidth;
    setScrollState((prev) =>
      prev.canScroll === canScroll &&
      prev.thumbWidth === thumbWidth &&
      Math.abs(prev.thumbLeft - thumbLeft) < 0.5
        ? prev
        : { canScroll: true, thumbWidth, thumbLeft }
    );
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    syncThumb();
    const onScroll = () => syncThumb();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(() => syncThumb());
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    window.addEventListener("resize", syncThumb);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      observer.disconnect();
      window.removeEventListener("resize", syncThumb);
    };
  }, [syncThumb]);

  // Re-measure after column/data updates change table width.
  useLayoutEffect(() => {
    syncThumb();
  });

  useEffect(() => {
    function onMove(event: MouseEvent) {
      const drag = dragRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport) return;
      const thumbWidth = thumbWidthRef.current;
      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
      const maxThumbLeft = viewport.clientWidth - thumbWidth;
      if (maxThumbLeft <= 0 || maxScrollLeft <= 0) return;
      const deltaX = event.clientX - drag.startX;
      const nextScroll =
        drag.startScrollLeft + (deltaX / maxThumbLeft) * maxScrollLeft;
      viewport.scrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScroll));
    }
    function onUp() {
      dragRef.current = null;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="jobs-list-table-scroll">
      <div ref={viewportRef} className="jobs-list-table-viewport overflow-x-auto">
        {children}
      </div>
      {scrollState.canScroll ? (
        <div
          ref={trackRef}
          className="jobs-list-table-scrollbar-track"
          onMouseDown={(event) => {
            const viewport = viewportRef.current;
            const track = trackRef.current;
            if (!viewport || !track) return;
            const trackRect = track.getBoundingClientRect();
            const clickX = event.clientX - trackRect.left;
            const thumbWidth = thumbWidthRef.current;
            const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
            const maxThumbLeft = viewport.clientWidth - thumbWidth;
            if (maxThumbLeft <= 0) return;
            const targetLeft = Math.min(
              maxThumbLeft,
              Math.max(0, clickX - thumbWidth / 2)
            );
            viewport.scrollLeft = (targetLeft / maxThumbLeft) * maxScrollLeft;
          }}
        >
          <div
            className="jobs-list-table-scrollbar-thumb"
            style={{
              width: scrollState.thumbWidth,
              transform: `translateX(${scrollState.thumbLeft}px)`,
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const viewport = viewportRef.current;
              if (!viewport) return;
              dragRef.current = {
                startX: event.clientX,
                startScrollLeft: viewport.scrollLeft,
              };
              document.body.style.cursor = "pointer";
              document.body.style.userSelect = "none";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function jobSourceType(job: JobListRow): "Internal" | "MSP" {
  const raw = String(job.source_type ?? "").trim().toLowerCase();
  if (raw === "msp") return "MSP";
  return "Internal";
}

function jobListStatus(job: JobListRow) {
  return normalizeJobRequisitionStatus(String(job.status ?? ""));
}

function matchesJobTab(job: JobListRow, tab: JobTab, starredIds: Set<string>): boolean {
  const status = jobListStatus(job);
  switch (tab) {
    case "all":
      return status !== "archived";
    case "internal":
      return status !== "archived" && jobSourceType(job) === "Internal";
    case "msp":
      return status !== "archived" && jobSourceType(job) === "MSP";
    case "draft":
      return status === "draft";
    case "open":
      return status === "published" && isJobRequisitionOpen(job);
    case "closed":
      return status === "closed";
    case "archived":
      return status === "archived";
    case "hot":
      return starredIds.has(job.id);
    default:
      return true;
  }
}

const JOBS_FILTER_SELECT_CLASS = `${JOBS_FORM_SURFACE_CLASS} h-10 w-full min-w-0 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 sm:h-8 sm:min-w-[100px] sm:max-w-[160px] sm:w-auto`;

/** Native select chevron — inset from the right edge for even padding. */
const JOBS_FILTER_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

const JOBS_FILTER_GRID_CONTROL_CLASS = `${JOBS_FORM_SURFACE_CLASS} h-10 w-full min-w-0 px-2.5 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 appearance-auto cursor-pointer`;

const JOBS_FILTER_GRID_SELECT_CLASS = `${JOBS_FILTER_GRID_CONTROL_CLASS} appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat pr-8`;

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

function JobsFiltersMenu({
  menuId,
  style,
  filtersVisible,
  onHideOrShowFilters,
  onMoreFilters,
  onClose,
}: {
  menuId: string;
  style: CSSProperties;
  filtersVisible: boolean;
  onHideOrShowFilters: () => void;
  onMoreFilters: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      id={menuId}
      role="menu"
      style={style}
      className="z-[200] min-w-[168px] overflow-visible rounded-md border border-[#dce6e3] bg-white py-1 shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onHideOrShowFilters();
          onClose();
        }}
        className="flex w-full items-center whitespace-nowrap px-3 py-2.5 text-left text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
        style={CANDIDATES_PAGE_SUBTITLE_STYLE}
      >
        {filtersVisible ? "Hide Filters" : "Show Filters"}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onMoreFilters();
          onClose();
        }}
        className="flex w-full items-center whitespace-nowrap px-3 py-2.5 text-left text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
        style={CANDIDATES_PAGE_SUBTITLE_STYLE}
      >
        More Filters
      </button>
    </div>,
    document.body
  );
}

function JobsFiltersDropdown({
  filtersVisible,
  hasActiveFilters,
  onToggleFiltersVisibility,
  onMoreFilters,
  className = "",
  showLabel = false,
}: {
  filtersVisible: boolean;
  hasActiveFilters: boolean;
  onToggleFiltersVisibility: () => void;
  onMoreFilters: () => void;
  className?: string;
  showLabel?: boolean;
}) {
  const autoId = useId();
  const menuId = `${autoId}-filters-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const isOn = filtersVisible || hasActiveFilters || open;

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 168),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, menuId]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Filters"
        title="Filters"
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border text-sm font-medium whitespace-nowrap transition sm:h-8 ${
          showLabel ? "w-auto px-3" : "w-9"
        } ${
          isOn
            ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
            : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
        }`}
      >
        <JobsFilterIcon />
        {showLabel ? (
          <>
            <span>Filters</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        ) : null}
      </button>
      {open && menuStyle && typeof document !== "undefined" ? (
        <JobsFiltersMenu
          menuId={menuId}
          style={menuStyle}
          filtersVisible={filtersVisible}
          onHideOrShowFilters={onToggleFiltersVisibility}
          onMoreFilters={onMoreFilters}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function JobsFilterSelect({
  label,
  value,
  onChange,
  children,
  variant = "inline",
  placeholder = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  variant?: "inline" | "grid";
  placeholder?: string;
}) {
  const controlClass =
    variant === "grid"
      ? `${JOBS_FILTER_GRID_SELECT_CLASS} ${value ? "text-[#334155]" : "text-[#94A3B8]"}`
      : `${JOBS_FILTER_SELECT_CLASS} ${value ? "text-[#334155]" : "text-[#94A3B8]"}`;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={controlClass}
      style={{ ...CANDIDATES_PAGE_SUBTITLE_STYLE, ...JOBS_FILTER_SELECT_CHEVRON }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function InlineLabeledFilter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="whitespace-nowrap text-sm font-medium text-[#475569]">{label}:</span>
      {children}
    </div>
  );
}

type JobsFilterFieldsProps = {
  variant: "grid" | "inline";
  professionFilter: string;
  onProfessionFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  placementTypeFilter: string;
  onPlacementTypeFilterChange: (value: string) => void;
  locationFilter: string;
  onLocationFilterChange: (value: string) => void;
  professionOptions: string[];
  placementTypeOptions: string[];
  locationOptions: string[];
  resultsCount?: number;
  showStarredOnly?: boolean;
  onToggleStarredOnly?: () => void;
};

function JobsFilterFields({
  variant,
  professionFilter,
  onProfessionFilterChange,
  statusFilter,
  onStatusFilterChange,
  placementTypeFilter,
  onPlacementTypeFilterChange,
  locationFilter,
  onLocationFilterChange,
  professionOptions,
  placementTypeOptions,
  locationOptions,
  resultsCount,
  showStarredOnly = false,
  onToggleStarredOnly,
}: JobsFilterFieldsProps) {
  const professionSelect = (
    <JobsFilterSelect
      label="Profession"
      value={professionFilter}
      onChange={onProfessionFilterChange}
      variant={variant}
    >
      {professionOptions.map((profession) => (
        <option key={profession} value={profession}>
          {profession}
        </option>
      ))}
    </JobsFilterSelect>
  );

  const statusSelect = (
    <JobsFilterSelect
      label="Status"
      value={statusFilter}
      onChange={onStatusFilterChange}
      variant={variant}
    >
      <option value="draft">Draft</option>
      <option value="published">Published</option>
      <option value="closed">Closed</option>
      <option value="archived">Archived</option>
    </JobsFilterSelect>
  );

  const placementTypeSelect = (
    <JobsFilterSelect
      label="Employment Type"
      value={placementTypeFilter}
      onChange={onPlacementTypeFilterChange}
      variant={variant}
    >
      {placementTypeOptions.map((placementType) => (
        <option key={placementType} value={placementType}>
          {placementType}
        </option>
      ))}
    </JobsFilterSelect>
  );

  const locationSelect = (
    <JobsFilterSelect
      label="Location"
      value={locationFilter}
      onChange={onLocationFilterChange}
      variant={variant}
    >
      {locationOptions.map((location) => (
        <option key={location} value={location}>
          {location}
        </option>
      ))}
    </JobsFilterSelect>
  );

  if (variant === "grid") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-5 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5 min-[600px]:grid-cols-2 lg:grid-cols-4">
          <CompactFilterField label="Profession">{professionSelect}</CompactFilterField>
          <CompactFilterField label="Status">{statusSelect}</CompactFilterField>
          <CompactFilterField label="Employment Type">{placementTypeSelect}</CompactFilterField>
          <CompactFilterField label="Location">{locationSelect}</CompactFilterField>
        </div>
        {/* Hidden below 450px — shown centered in the mobile toolbar instead.
            Centered on tablet/mobile ≥450px; desktop keeps it inline in the filters row. */}
        {typeof resultsCount === "number" ? (
          <div className="flex w-full shrink-0 items-center justify-center gap-5 max-[449px]:hidden">
            <button
              type="button"
              onClick={onToggleStarredOnly}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-[#F8FAFC] ${
                showStarredOnly ? "border-[#FFC800] bg-[#FFF8E6]" : ""
              }`}
              aria-pressed={showStarredOnly}
              aria-label={showStarredOnly ? "Show all jobs" : "Show starred jobs only"}
              title={showStarredOnly ? "Show all jobs" : "Show starred jobs only"}
            >
              {showStarredOnly ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={JOBS_STAR_FILLED_SRC}
                  alt=""
                  width={14}
                  height={14}
                  className="h-[14px] w-[14px] shrink-0"
                  aria-hidden
                />
              ) : (
                <span
                  aria-hidden
                  className="inline-block h-[14px] w-[14px] shrink-0 bg-[#94A3B8]"
                  style={{
                    maskImage: `url(${JOBS_STAR_FILLED_SRC})`,
                    WebkitMaskImage: `url(${JOBS_STAR_FILLED_SRC})`,
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                  }}
                />
              )}
            </button>
            <span className="whitespace-nowrap text-sm font-medium text-[#334155]">
              {resultsCount} results
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-5">
      <InlineLabeledFilter label="Profession">{professionSelect}</InlineLabeledFilter>
      <InlineLabeledFilter label="Status">{statusSelect}</InlineLabeledFilter>
      <InlineLabeledFilter label="Employment Type">{placementTypeSelect}</InlineLabeledFilter>
      <InlineLabeledFilter label="Location">{locationSelect}</InlineLabeledFilter>
      {typeof resultsCount === "number" ? (
        <div className="flex shrink-0 items-center gap-5">
          <button
            type="button"
            onClick={onToggleStarredOnly}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-[#F8FAFC] ${
              showStarredOnly ? "border-[#FFC800] bg-[#FFF8E6]" : ""
            }`}
            aria-pressed={showStarredOnly}
            aria-label={showStarredOnly ? "Show all jobs" : "Show starred jobs only"}
            title={showStarredOnly ? "Show all jobs" : "Show starred jobs only"}
          >
            {showStarredOnly ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={JOBS_STAR_FILLED_SRC}
                alt=""
                width={14}
                height={14}
                className="h-[14px] w-[14px] shrink-0"
                aria-hidden
              />
            ) : (
              <span
                aria-hidden
                className="inline-block h-[14px] w-[14px] shrink-0 bg-[#94A3B8]"
                style={{
                  maskImage: `url(${JOBS_STAR_FILLED_SRC})`,
                  WebkitMaskImage: `url(${JOBS_STAR_FILLED_SRC})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            )}
          </button>
          <span className="whitespace-nowrap text-sm font-medium text-[#334155]">
            {resultsCount} results
          </span>
        </div>
      ) : null}
    </div>
  );
}

const JOB_ACTIONS_MENU_WIDTH = 140;
const JOB_ACTIONS_MENU_ESTIMATED_HEIGHT = 240;

function canRepublishClosedJob(job: JobListRow): boolean {
  return isJobRequisitionOpen({ application_deadline: job.application_deadline });
}

function JobActionsMenuPortal({
  job,
  anchor,
  onClose,
  onTransition,
}: {
  job: JobListRow;
  anchor: HTMLElement;
  onClose: () => void;
  onTransition: (jobId: string, action: "publish" | "unpublish" | "close" | "archive" | "unarchive") => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + JOB_ACTIONS_MENU_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - JOB_ACTIONS_MENU_ESTIMATED_HEIGHT - 4);
    }
    setStyle({
      position: "fixed",
      top,
      left: Math.max(8, rect.right - JOB_ACTIONS_MENU_WIDTH),
      width: JOB_ACTIONS_MENU_WIDTH,
      visibility: "visible",
    });
  }, [anchor]);

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

  const status = jobListStatus(job);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={style}
      className={`z-[200] min-w-[140px] ${JOBS_FORM_SURFACE_CLASS} py-1 shadow-lg`}
    >
      {status === "closed" ? (
        <>
          <Link
            href={`/admin_recruiter/jobs/${job.id}`}
            role="menuitem"
            className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
            onClick={onClose}
          >
            View
          </Link>
          <Link
            href={`/admin_recruiter/jobs/${job.id}/edit`}
            role="menuitem"
            className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
            onClick={onClose}
          >
            Edit
          </Link>
          {canRepublishClosedJob(job) ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onTransition(job.id, "publish");
                onClose();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
            >
              Republish
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTransition(job.id, "archive");
              onClose();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
          >
            Archive
          </button>
        </>
      ) : (
        <>
          <Link
            href={`/admin_recruiter/jobs/${job.id}`}
            role="menuitem"
            className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
            onClick={onClose}
          >
            View
          </Link>
          {status !== "archived" ? (
            <Link
              href={`/admin_recruiter/jobs/${job.id}/edit`}
              role="menuitem"
              className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
              onClick={onClose}
            >
              Edit
            </Link>
          ) : null}
          {status === "draft" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTransition(job.id, "publish");
                  onClose();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
              >
                Publish
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTransition(job.id, "close");
                  onClose();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
              >
                Close
              </button>
            </>
          ) : null}
          {status === "published" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTransition(job.id, "unpublish");
                  onClose();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
              >
                Unpublish
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTransition(job.id, "close");
                  onClose();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
              >
                Close
              </button>
            </>
          ) : null}
          {status === "archived" ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onTransition(job.id, "unarchive");
                onClose();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
            >
              Unarchive
            </button>
          ) : status === "draft" || status === "published" ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onTransition(job.id, "archive");
                onClose();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
            >
              Archive
            </button>
          ) : null}
        </>
      )}
    </div>,
    document.body
  );
}

export default function AdminRecruiterJobsPage() {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding);

  const [jobs, setJobs] = useState<JobListRow[]>([]);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [jobTab, setJobTab] = useState<JobTab>("all");
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [listColumnOrder, setListColumnOrder] = useState<JobColumnId[]>(DEFAULT_JOB_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [openActionsMenu, setOpenActionsMenu] = useState<{
    job: JobListRow;
    anchor: HTMLElement;
  } | null>(null);
  const [publishBusyIds, setPublishBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [professionFilter, setProfessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  /** Employment Type filter (shift_type) — kept name for existing inline filter bar. */
  const [placementTypeFilter, setPlacementTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationTypeFilter, setLocationTypeFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [contractGroupFilter, setContractGroupFilter] = useState("");
  const [w2TypeFilter, setW2TypeFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [payRateFilter, setPayRateFilter] = useState("");
  const [datePostedFilter, setDatePostedFilter] = useState("");
  const [editFiltersOpen, setEditFiltersOpen] = useState(false);
  const [sortField, setSortField] = useState<JobSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [listingView, setListingView] = useState<JobsListingView>("list");

  const handleToggleSort = useCallback((field: JobSortField) => {
    setSortField((current) => {
      if (current === field) {
        setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDirection("asc");
      return field;
    });
    setPage(1);
  }, []);

  const handleListingViewChange = useCallback((next: JobsListingView) => {
    setListingView(next);
    saveJobsListingView(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
      setJobs(payload.jobs ?? []);
      setTenantSlug(
        typeof payload.tenantSlug === "string" && payload.tenantSlug.trim()
          ? payload.tenantSlug.trim().toLowerCase()
          : null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setListColumnOrder(loadJobColumnOrder());
    setStarredIds(loadStarredJobIds());
    setListingView(loadJobsListingView());
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    jobTab,
    professionFilter,
    statusFilter,
    placementTypeFilter,
    locationFilter,
    locationTypeFilter,
    specialtyFilter,
    contractGroupFilter,
    w2TypeFilter,
    sourceTypeFilter,
    workflowFilter,
    payRateFilter,
    datePostedFilter,
    showStarredOnly,
    pageSize,
  ]);

  async function transition(
    jobId: string,
    action: "publish" | "unpublish" | "close" | "archive" | "unarchive"
  ) {
    setPublishBusyIds((current) => new Set(current).add(jobId));
    const job = jobs.find((item) => item.id === jobId);
    const jobTitle = job ? jobListDisplayTitle(job) : "Job";
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload.error || "Failed to update job";
        setError(message);
        toast.error(message);
        return;
      }
      setOpenActionsMenu(null);
      setError("");
      if (action === "archive") {
        toast.success(`${jobTitle} archived successfully`, { duration: 4000 });
        setJobTab("archived");
      } else if (action === "unarchive") {
        toast.success(`${jobTitle} restored from archive`, { duration: 4000 });
        setJobTab("draft");
      } else if (action === "close") {
        toast.success(`${jobTitle} closed`, { duration: 4000 });
      } else if (action === "publish") {
        toast.success(`${jobTitle} published`, { duration: 4000 });
      } else if (action === "unpublish") {
        toast.success(`${jobTitle} unpublished`, { duration: 4000 });
      }
      await load();
    } finally {
      setPublishBusyIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        return next;
      });
    }
  }

  function handlePublishToggle(job: JobListRow) {
    if (publishBusyIds.has(job.id)) return;
    const status = jobListStatus(job);
    if (status === "published") {
      void transition(job.id, "unpublish");
      return;
    }
    if (status === "draft") {
      void transition(job.id, "publish");
      return;
    }
    if (status === "closed" && canRepublishClosedJob(job)) {
      void transition(job.id, "publish");
    }
  }

  const tabCounts = useMemo(() => {
    const counts: Record<JobTab, number> = {
      all: 0,
      internal: 0,
      msp: 0,
      draft: 0,
      open: 0,
      closed: 0,
      archived: 0,
      hot: 0,
    };
    for (const job of jobs) {
      const status = jobListStatus(job);
      if (status !== "archived") counts.all += 1;
      if (matchesJobTab(job, "internal", starredIds)) counts.internal += 1;
      if (matchesJobTab(job, "msp", starredIds)) counts.msp += 1;
      if (matchesJobTab(job, "draft", starredIds)) counts.draft += 1;
      if (matchesJobTab(job, "open", starredIds)) counts.open += 1;
      if (matchesJobTab(job, "closed", starredIds)) counts.closed += 1;
      if (matchesJobTab(job, "archived", starredIds)) counts.archived += 1;
      if (matchesJobTab(job, "hot", starredIds)) counts.hot += 1;
    }
    return counts;
  }, [jobs, starredIds]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!matchesJobTab(job, jobTab, starredIds)) return false;

      if (showStarredOnly && !starredIds.has(job.id)) return false;

      if (professionFilter && jobProfession(job) !== professionFilter) return false;

      if (statusFilter && jobListStatus(job) !== statusFilter) return false;

      if (placementTypeFilter && jobShiftType(job) !== placementTypeFilter) return false;

      if (locationFilter && jobLocation(job) !== locationFilter) return false;

      if (locationTypeFilter && jobPlacementType(job) !== locationTypeFilter) return false;

      if (specialtyFilter && relationNameFromJob(job.specialties) !== specialtyFilter) return false;

      if (contractGroupFilter && jobContractGroup(job) !== contractGroupFilter) return false;

      if (w2TypeFilter && (job.employment_type || "").trim() !== w2TypeFilter) return false;

      if (sourceTypeFilter) {
        const source = String(job.source_type ?? "").trim();
        if (source.toLowerCase() !== sourceTypeFilter.toLowerCase()) return false;
      }

      if (workflowFilter && relationNameFromJob(job.onboarding_flows) !== workflowFilter) {
        return false;
      }

      if (!jobMatchesPayRateFilter(job, payRateFilter)) return false;

      if (!jobMatchesDatePostedFilter(job, datePostedFilter)) return false;

      return true;
    });
  }, [
    jobs,
    jobTab,
    showStarredOnly,
    starredIds,
    professionFilter,
    statusFilter,
    placementTypeFilter,
    locationFilter,
    locationTypeFilter,
    specialtyFilter,
    contractGroupFilter,
    w2TypeFilter,
    sourceTypeFilter,
    workflowFilter,
    payRateFilter,
    datePostedFilter,
  ]);

  const sortedJobs = useMemo(() => {
    if (!sortField) return filteredJobs;

    const next = [...filteredJobs];
    next.sort((a, b) => {
      const left = jobSortValue(a, sortField);
      const right = jobSortValue(b, sortField);
      let cmp = 0;
      if (typeof left === "number" && typeof right === "number") {
        cmp = left - right;
      } else {
        cmp = String(left).localeCompare(String(right), undefined, {
          sensitivity: "base",
          numeric: true,
        });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return next;
  }, [filteredJobs, sortField, sortDirection]);

  /** Selected rows when any are checked; otherwise current filtered/sorted result set. */
  const exportJobs = useMemo(() => {
    if (selectedIds.size === 0) return sortedJobs;
    const selected = sortedJobs.filter((job) => selectedIds.has(job.id));
    return selected.length > 0 ? selected : sortedJobs;
  }, [sortedJobs, selectedIds]);

  const handleExportCsv = useCallback(() => {
    if (exportJobs.length === 0) {
      toast.error("No jobs to export");
      return;
    }
    exportJobsCsv(exportJobs, { columnOrder: listColumnOrder });
  }, [exportJobs, listColumnOrder]);

  const handleExportXls = useCallback(() => {
    if (exportJobs.length === 0) {
      toast.error("No jobs to export");
      return;
    }
    exportJobsXls(exportJobs, { columnOrder: listColumnOrder });
  }, [exportJobs, listColumnOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = sortedJobs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, sortedJobs.length);
  const paginatedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allVisibleSelected =
    paginatedJobs.length > 0 && paginatedJobs.every((job) => selectedIds.has(job.id));

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const job of paginatedJobs) next.delete(job.id);
      } else {
        for (const job of paginatedJobs) next.add(job.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmDeleteJobs() {
    if (deleteBusy || selectedIds.size === 0) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Failed to delete jobs");
      }
      const deletedIds = new Set<string>(
        Array.isArray(payload.deletedIds) ? payload.deletedIds.map(String) : []
      );
      setJobs((current) => current.filter((job) => !deletedIds.has(job.id)));
      setStarredIds((current) => {
        const next = new Set(current);
        for (const id of deletedIds) next.delete(id);
        saveStarredJobIds(next);
        return next;
      });
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      toast.success(
        `Deleted ${typeof payload.count === "number" ? payload.count : deletedIds.size} job${
          (payload.count ?? deletedIds.size) === 1 ? "" : "s"
        }`
      );
    } catch (deleteErr) {
      const message = deleteErr instanceof Error ? deleteErr.message : "Failed to delete jobs";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const professionOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const profession = jobProfession(job);
      if (profession) values.add(profession);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const placementTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const placementType = jobShiftType(job);
      if (placementType) values.add(placementType);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const loc = jobLocation(job);
      if (loc && loc !== "—") values.add(loc);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const locationTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const value = jobPlacementType(job);
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const specialtyOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const value = relationNameFromJob(job.specialties);
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const contractGroupOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const value = jobContractGroup(job);
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const w2TypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const value = (job.employment_type || "").trim();
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const sourceTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const value = String(job.source_type ?? "").trim();
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const workflowOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const value = relationNameFromJob(job.onboarding_flows);
      if (value) values.add(value);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const listColumns = listColumnOrder.length ? listColumnOrder : DEFAULT_JOB_COLUMNS;

  const hasActiveFilters = Boolean(
    professionFilter ||
      statusFilter ||
      placementTypeFilter ||
      locationFilter ||
      locationTypeFilter ||
      specialtyFilter ||
      contractGroupFilter ||
      w2TypeFilter ||
      sourceTypeFilter ||
      workflowFilter ||
      payRateFilter ||
      datePostedFilter ||
      showStarredOnly
  );

  const editFiltersValue = useMemo(
    (): JobsExtendedFilterValues => ({
      profession: professionFilter,
      status: statusFilter,
      employmentType: placementTypeFilter,
      location: locationFilter,
      placementType: locationTypeFilter,
      specialty: specialtyFilter,
      contractGroup: contractGroupFilter,
      w2Type: w2TypeFilter,
      sourceType: sourceTypeFilter,
      workflow: workflowFilter,
      payRate: payRateFilter,
      datePosted: datePostedFilter,
    }),
    [
      professionFilter,
      statusFilter,
      placementTypeFilter,
      locationFilter,
      locationTypeFilter,
      specialtyFilter,
      contractGroupFilter,
      w2TypeFilter,
      sourceTypeFilter,
      workflowFilter,
      payRateFilter,
      datePostedFilter,
    ]
  );

  const handleSaveEditFilters = useCallback((next: JobsExtendedFilterValues) => {
    setProfessionFilter(next.profession);
    setStatusFilter(next.status);
    setPlacementTypeFilter(next.employmentType);
    setLocationFilter(next.location);
    setLocationTypeFilter(next.placementType);
    setSpecialtyFilter(next.specialty);
    setContractGroupFilter(next.contractGroup);
    setW2TypeFilter(next.w2Type);
    setSourceTypeFilter(next.sourceType);
    setWorkflowFilter(next.workflow);
    setPayRateFilter(next.payRate);
    setDatePostedFilter(next.datePosted);
  }, []);

  const handleResetFilters = useCallback(() => {
    handleSaveEditFilters(EMPTY_JOBS_EXTENDED_FILTERS);
    setShowStarredOnly(false);
  }, [handleSaveEditFilters]);

  const jobListCellContext = useMemo((): JobListCellContext => {
    return {
      brandingSecondaryHex: branding.secondaryHex,
      tenantSlug,
      starredIds,
      onToggleStar: (jobId) => {
        setStarredIds((current) => {
          const next = new Set(current);
          if (next.has(jobId)) next.delete(jobId);
          else next.add(jobId);
          saveStarredJobIds(next);
          return next;
        });
      },
      openActionsJobId: openActionsMenu?.job.id ?? null,
      onOpenActionsMenu: (job, anchor) => {
        setOpenActionsMenu((current) => (current?.job.id === job.id ? null : { job, anchor }));
      },
      publishBusyIds,
      onPublishToggle: handlePublishToggle,
    };
  }, [branding.secondaryHex, tenantSlug, starredIds, openActionsMenu?.job.id, publishBusyIds]);

  return (
    <div className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8" style={brandStyle}>
      <div className="mb-8">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Jobs
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Manage jobs posting in one place
        </p>
      </div>

      <div className="mb-4 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <nav className="w-full min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" aria-label="Jobs navigation">
          <div className="flex w-max flex-nowrap items-center justify-start gap-5">
            {JOB_TABS.map((tab) => {
              const active = jobTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setJobTab(tab.id)}
                  className={`relative inline-flex shrink-0 flex-col items-center px-2 pb-2.5 pt-0 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                    active
                      ? "text-[color:var(--brand-primary)]"
                      : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{tab.label}</span>
                    <span className="admin-recruiter-tab-count rounded-sm">{tabCounts[tab.id]}</span>
                  </span>
                  <span
                    className={`absolute inset-x-0 bottom-0 block h-0.5 rounded-full ${
                      active ? "bg-[color:var(--brand-primary)]" : "bg-transparent"
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ListExportDropdown
            onExportCsv={handleExportCsv}
            onExportXls={handleExportXls}
            disabled={exportJobs.length === 0}
          />
          <button
            type="button"
            disabled
            className={JOBS_BULK_PRIMARY_BUTTON_CLASS}
            style={{ backgroundColor: branding.primaryHex }}
            aria-label="Import from MSP (coming soon)"
            title="Coming soon"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Import from MSP
          </button>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        {/* Mobile / tablet toolbar */}
        <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-3 py-2.5 xl:hidden">
          <div className="flex w-full items-center gap-2">
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <JobsFiltersDropdown
                filtersVisible={showFilterRows}
                hasActiveFilters={hasActiveFilters}
                onToggleFiltersVisibility={() => setShowFilterRows((value) => !value)}
                onMoreFilters={() => setEditFiltersOpen(true)}
                className="shrink-0"
              />
              <MobileIconButton onClick={() => setEditColumnsOpen(true)} label="Columns">
                <JobsColumnsIcon />
              </MobileIconButton>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={`${JOBS_TOOLBAR_BUTTON_CLASS} shrink-0 whitespace-nowrap`}
                  style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                >
                  Reset Filters
                </button>
              ) : null}
              <BulkDeleteToolbarButton
                count={selectedIds.size}
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
              />
            </div>
            {/* Star + results: centered in toolbar below 450px */}
            <div className="hidden min-w-0 flex-1 items-center justify-center max-[449px]:flex">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStarredOnly((value) => !value)}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-[#F8FAFC] ${
                    showStarredOnly ? "border-[#FFC800] bg-[#FFF8E6]" : ""
                  }`}
                  aria-pressed={showStarredOnly}
                  aria-label={showStarredOnly ? "Show all jobs" : "Show starred jobs only"}
                  title={showStarredOnly ? "Show all jobs" : "Show starred jobs only"}
                >
                  {showStarredOnly ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={JOBS_STAR_FILLED_SRC}
                      alt=""
                      width={14}
                      height={14}
                      className="h-[14px] w-[14px] shrink-0"
                      aria-hidden
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="inline-block h-[14px] w-[14px] shrink-0 bg-[#94A3B8]"
                      style={{
                        maskImage: `url(${JOBS_STAR_FILLED_SRC})`,
                        WebkitMaskImage: `url(${JOBS_STAR_FILLED_SRC})`,
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                        maskPosition: "center",
                        WebkitMaskPosition: "center",
                      }}
                    />
                  )}
                </button>
                <span className="whitespace-nowrap text-sm font-medium text-[#334155]">
                  {filteredJobs.length} results
                </span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 max-[449px]:ml-0 sm:gap-2">
              <Link
                href="/admin_recruiter/jobs/new"
                className={`${JOBS_POST_JOB_BUTTON_CLASS} inline-flex h-9 items-center gap-1.5 px-2.5 sm:h-8 sm:px-3`}
              >
                <Plus
                  className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                  style={{ color: branding.secondaryHex }}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="hidden min-[480px]:inline">Post a job</span>
                <span className="min-[480px]:hidden">Post</span>
              </Link>
              <JobsViewToggle value={listingView} onChange={handleListingViewChange} />
            </div>
          </div>
          {showFilterRows ? (
            <JobsFilterFields
              variant="grid"
              professionFilter={professionFilter}
              onProfessionFilterChange={setProfessionFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              placementTypeFilter={placementTypeFilter}
              onPlacementTypeFilterChange={setPlacementTypeFilter}
              locationFilter={locationFilter}
              onLocationFilterChange={setLocationFilter}
              professionOptions={professionOptions}
              placementTypeOptions={placementTypeOptions}
              locationOptions={locationOptions}
              resultsCount={filteredJobs.length}
              showStarredOnly={showStarredOnly}
              onToggleStarredOnly={() => setShowStarredOnly((value) => !value)}
            />
          ) : null}
        </div>

        {/* Desktop toolbar */}
        <div className="hidden w-full flex-col xl:flex">
          <div className="flex w-full shrink-0 items-center justify-between gap-3 rounded-t-[12px] bg-white px-[14px] py-3">
            <div className="flex shrink-0 items-center gap-2">
              <JobsFiltersDropdown
                filtersVisible={showFilterRows}
                hasActiveFilters={hasActiveFilters}
                onToggleFiltersVisibility={() => setShowFilterRows((value) => !value)}
                onMoreFilters={() => setEditFiltersOpen(true)}
                showLabel
              />
              <button
                type="button"
                onClick={() => setEditColumnsOpen(true)}
                className={JOBS_TOOLBAR_BUTTON_CLASS}
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <JobsColumnsIcon />
                Columns
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={JOBS_TOOLBAR_BUTTON_CLASS}
                  style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                >
                  Reset Filters
                </button>
              ) : null}
              <BulkDeleteToolbarButton
                count={selectedIds.size}
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/admin_recruiter/jobs/new" className={JOBS_POST_JOB_BUTTON_CLASS}>
                <Plus
                  className="h-5 w-5 shrink-0"
                  style={{ color: branding.secondaryHex }}
                  strokeWidth={2}
                  aria-hidden
                />
                Post a job
              </Link>
              <JobsViewToggle value={listingView} onChange={handleListingViewChange} />
            </div>
          </div>

          <div className="border-b border-[#E5E7EB]" aria-hidden />

          {showFilterRows ? (
            <div className="flex w-full shrink-0 items-center gap-3 overflow-x-auto border-b border-[#E5E7EB] px-[14px] py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <JobsFilterFields
                variant="inline"
                professionFilter={professionFilter}
                onProfessionFilterChange={setProfessionFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                placementTypeFilter={placementTypeFilter}
                onPlacementTypeFilterChange={setPlacementTypeFilter}
                locationFilter={locationFilter}
                onLocationFilterChange={setLocationFilter}
                professionOptions={professionOptions}
                placementTypeOptions={placementTypeOptions}
                locationOptions={locationOptions}
                resultsCount={filteredJobs.length}
                showStarredOnly={showStarredOnly}
                onToggleStarredOnly={() => setShowStarredOnly((value) => !value)}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mx-[14px] mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {listingView === "grid" ? (
          <JobsGridView
            jobs={paginatedJobs}
            loading={loading}
            emptyMessage={
              showStarredOnly
                ? "No starred jobs yet. Click the star next to a job title to save it here."
                : "No jobs match these filters."
            }
            tenantSlug={tenantSlug}
            onDelete={(jobId) => {
              setSelectedIds(new Set([jobId]));
              setDeleteError(null);
              setDeleteConfirmOpen(true);
            }}
            onDuplicate={() => {
              toast("Duplicate job will be available in a later update.");
            }}
          />
        ) : (
        <JobsListScrollArea>
          <table className="w-max min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium uppercase tracking-wide text-black">
              <tr>
                <th className="w-12 shrink-0 whitespace-nowrap border-r border-[#E5E7EB] px-[14px] py-3">
                  <ListTableCheckbox
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible jobs"
                  />
                </th>
                {listColumns.map((colId) => (
                  <th
                    key={colId}
                    className={`whitespace-nowrap border-r border-[#E5E7EB] px-[14px] py-3 font-medium normal-case tracking-normal last:border-r-0 ${jobListColumnClassName(colId)}`}
                    aria-sort={
                      isSortableJobColumn(colId) && sortField === colId
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {isSortableJobColumn(colId) ? (
                      <JobTableSortHeader
                        colId={colId}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onToggleSort={handleToggleSort}
                      />
                    ) : (
                      <span
                        className={`whitespace-nowrap ${
                          isCenterAlignedJobColumn(colId) ? "mx-auto block w-fit" : ""
                        }`}
                      >
                        {jobColumnLabel(colId)}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-b border-[#E9EDF3]">
                  <td colSpan={listColumns.length + 1} className="px-[14px] py-12 text-center text-[#64748B]">
                    Loading jobs…
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr className="border-b border-[#E9EDF3]">
                  <td colSpan={listColumns.length + 1} className="px-[14px] py-12 text-center text-[#64748B]">
                    {showStarredOnly
                      ? "No starred jobs yet. Click the star next to a job title to save it here."
                      : "No jobs match these filters."}
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr key={job.id} className="border-b border-[#E9EDF3] align-middle hover:bg-[#FAFBFC]">
                    <td className="border-r border-[#E5E7EB] px-[14px] py-2.5 align-middle">
                      <ListTableCheckbox
                        checked={selectedIds.has(job.id)}
                        onChange={() => toggleSelect(job.id)}
                        aria-label={`Select ${jobListDisplayTitle(job)}`}
                      />
                    </td>
                    {listColumns.map((colId) => (
                      <td
                        key={colId}
                        className={`border-r border-[#E5E7EB] align-middle last:border-r-0 ${jobListColumnClassName(colId)} ${
                          colId === "candidates"
                            ? "px-0 py-0"
                            : colId === "actions"
                              ? "px-0 py-0"
                              : "px-[14px] py-4"
                        }`}
                      >
                        {renderJobListCell(colId, job, jobListCellContext)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </JobsListScrollArea>
        )}

        <div className="flex flex-col gap-3 rounded-b-[12px] border-t border-[#E5E7EB] bg-white px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-sm text-[#64748B]">
            Showing {pageStart}-{pageEnd} of {filteredJobs.length} results
          </p>

          <div className="flex w-full flex-wrap items-center justify-center gap-3 sm:w-auto sm:justify-end">
            <ListPaginationShowLabel
              pageSize={pageSize}
              options={PAGE_SIZE_OPTIONS}
              onPageSizeChange={setPageSize}
            />

            <ListPaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              activeStyle={{ backgroundColor: branding.secondaryHex, borderColor: branding.secondaryHex }}
            />
          </div>
        </div>
      </div>

      {openActionsMenu ? (
        <JobActionsMenuPortal
          job={openActionsMenu.job}
          anchor={openActionsMenu.anchor}
          onClose={() => setOpenActionsMenu(null)}
          onTransition={(jobId, action) => void transition(jobId, action)}
        />
      ) : null}

      <ColumnsEditorModal
        key={editColumnsOpen ? "job-cols-open" : "job-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        options={JOB_COLUMN_OPTIONS}
        value={listColumnOrder}
        title="Edit Columns"
        description="Choose which columns appear in the jobs list and drag to reorder them."
        onSave={(order) => {
          setListColumnOrder(order);
          saveJobColumnOrder(order);
        }}
      />

      <EditJobsFiltersModal
        key={editFiltersOpen ? "job-filters-open" : "job-filters-closed"}
        open={editFiltersOpen}
        onOpenChange={setEditFiltersOpen}
        value={editFiltersValue}
        options={{
          professions: professionOptions,
          employmentTypes: placementTypeOptions,
          locations: locationOptions,
          placementTypes: locationTypeOptions,
          specialties: specialtyOptions,
          contractGroups: contractGroupOptions,
          w2Types: w2TypeOptions,
          sourceTypes: sourceTypeOptions,
          workflows: workflowOptions,
        }}
        onSave={handleSaveEditFilters}
      />

      <BulkDeleteConfirmModal
        open={deleteConfirmOpen}
        entity="job"
        count={selectedIds.size}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDeleteJobs()}
      />
    </div>
  );
}
