"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

export type ExistingJobPickerOption = {
  id: string;
  public_title: string | null;
  location: string | null;
  facility: string | null;
  facility_name: string | null;
  status?: string;
  internal_requisition_number?: string | null;
  created_at?: string | null;
  published_at?: string | null;
};

const FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white";
const FILTER_SELECT_CLASS = `${FORM_SURFACE_CLASS} h-8 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0`;
const FILTER_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

function formatJobLocation(job: ExistingJobPickerOption): string {
  return (
    job.location?.trim() ||
    job.facility_name?.trim() ||
    job.facility?.trim() ||
    "—"
  );
}

function jobReference(option: ExistingJobPickerOption): string {
  return option.internal_requisition_number?.trim() || option.id.slice(0, 8).toUpperCase();
}

type ExistingJobPickerPanelProps = {
  jobs: ExistingJobPickerOption[];
  loading: boolean;
  selectedJobId: string | null;
  onSelectJob: (jobId: string | null) => void;
};

export function ExistingJobPickerPanel({
  jobs,
  loading,
  selectedJobId,
  onSelectJob,
}: ExistingJobPickerPanelProps) {
  const branding = useTenantBranding();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const loc = formatJobLocation(job);
      if (loc && loc !== "—") values.add(loc);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let next = jobs.filter((option) => {
      if (statusFilter && option.status !== statusFilter) return false;
      if (locationFilter) {
        const loc = formatJobLocation(option);
        if (loc !== locationFilter) return false;
      }
      if (q) {
        const title = (option.public_title ?? "").toLowerCase();
        const ref = jobReference(option).toLowerCase();
        if (!title.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });

    next = [...next].sort((a, b) => {
      const aTime = new Date(a.published_at || a.created_at || 0).getTime();
      const bTime = new Date(b.published_at || b.created_at || 0).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
    return next;
  }, [jobs, search, statusFilter, locationFilter, sortBy]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setLocationFilter("");
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white">
      <div className="space-y-3 border-b border-[#E5E7EB] p-3 sm:p-4">
        <label className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/search-candidate-jobs.svg"
            alt=""
            width={20}
            height={20}
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job title"
            className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-11 pr-3 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-decoration]:cursor-pointer"
          />
        </label>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${FILTER_SELECT_CLASS} shrink-0`}
              style={FILTER_SELECT_CHEVRON}
              aria-label="Filter by status"
            >
              <option value="">Active</option>
              <option value="published">Open</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className={`${FILTER_SELECT_CLASS} min-w-0 max-w-[140px] flex-1 sm:max-w-[180px] sm:flex-none`}
              style={FILTER_SELECT_CHEVRON}
              aria-label="Filter by location"
            >
              <option value="">Location</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 px-1 text-sm font-bold whitespace-nowrap text-black transition hover:opacity-80"
            >
              Clear all
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm whitespace-nowrap text-[#64748B]">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                className={`${FILTER_SELECT_CLASS} shrink-0`}
                style={FILTER_SELECT_CHEVRON}
                aria-label="Sort jobs"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
            <p className="inline-flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-[#64748B]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/jobs-count-icon.svg"
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              <span>{filteredJobs.length} of {jobs.length} jobs</span>
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 max-h-[min(360px,50vh)] overflow-x-hidden overflow-y-auto rounded-b-xl">
        {loading ? (
          <p className="px-4 py-6 text-sm text-[#64748B]">Loading jobs…</p>
        ) : filteredJobs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#64748B]">No jobs match these filters.</p>
        ) : (
          filteredJobs.map((option) => {
            const title = option.public_title?.trim() || "Untitled job";
            const location = formatJobLocation(option);
            const selected = option.id === selectedJobId;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelectJob(selected ? null : option.id)}
                className={`flex w-full items-center gap-3 border-b border-[#E5E7EB] px-3 py-3.5 text-left transition last:border-b-0 sm:px-4 ${
                  selected ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]" : "hover:bg-[#F8FAFC]"
                }`}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                  {selected ? (
                    <Check
                      className="h-5 w-5"
                      style={{ color: branding.primaryHex }}
                      strokeWidth={2.75}
                      aria-label="Selected job"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5 text-[#1E293B]">{title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-[#64748B]">
                    {location !== "—" ? location : jobReference(option)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
