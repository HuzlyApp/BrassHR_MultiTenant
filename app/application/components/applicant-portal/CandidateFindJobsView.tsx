"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  Search,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import { JobDescriptionHtml } from "@/lib/jobs/job-description-html";
import { applicationPath } from "@/lib/tenant/with-tenant";
import { CANDIDATE_BTN_NAVY, CANDIDATE_BTN_OUTLINE, CandidatePageIntro } from "./candidate-portal-ui";

export type CandidateJobCardModel = {
  key: string;
  token: string;
  title: string;
  location: string;
  employmentType: string;
  locationType: string;
  postedLabel: string;
  payLabel: string;
  descriptionHtml: string;
  qualifications: string;
  responsibilities: string;
  benefits: string;
  applied: boolean;
};

const PAGE_SIZE = 8;

function formatPosted(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCandidatePostedLabel(iso: string | null | undefined): string {
  const label = formatPosted(iso);
  return label ? `Posted: ${label}` : "";
}

export function formatCandidatePay(job: {
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  pay_rate?: number | null;
  pay_rate_period?: string | null;
  rate_unit?: string | null;
}): string {
  const period = (job.pay_rate_period || job.rate_unit || "hr").replace(/^\//, "");
  const min = job.pay_rate_min;
  const max = job.pay_rate_max;
  if (min != null && max != null && min !== max) return `$${min} - $${max} / ${period}`;
  const single = min ?? max ?? job.pay_rate;
  if (single == null || Number.isNaN(Number(single))) return "";
  return `$${single} / ${period}`;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <p className="text-sm leading-6 text-[#111827]">
      <span className="font-semibold">{label}: </span>
      <span className="font-normal text-[#374151]">{value}</span>
    </p>
  );
}

export function CandidateFindJobsView({
  companyName,
  jobs,
  loading,
  error,
  query,
  location,
  employmentType,
  onQueryChange,
  onLocationChange,
  onEmploymentTypeChange,
  onSearch,
  onApply,
}: {
  companyName: string;
  jobs: CandidateJobCardModel[];
  loading: boolean;
  error: string | null;
  query: string;
  location: string;
  employmentType: string;
  onQueryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onEmploymentTypeChange: (value: string) => void;
  onSearch: () => void;
  onApply: (token: string) => void;
}) {
  const searchParams = useSearchParams();
  const tenant = searchParams?.get("tenant");
  const [sort, setSort] = useState<"recent" | "pay">("recent");
  const [page, setPage] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const sorted = useMemo(() => {
    const next = [...jobs];
    if (sort === "pay") {
      next.sort((a, b) => {
        const amount = (label: string) => {
          const match = label.match(/\$(\d+(?:\.\d+)?)/g);
          if (!match?.length) return 0;
          return Math.max(...match.map((part) => Number(part.replace("$", ""))));
        };
        return amount(b.payLabel) - amount(a.payLabel);
      });
    }
    return next;
  }, [jobs, sort]);

  useEffect(() => {
    setPage(0);
  }, [jobs, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = sorted.find((job) => job.key === selectedKey) ?? visible[0] ?? sorted[0] ?? null;

  async function shareJob(job: CandidateJobCardModel) {
    const path = applicationPath(`/jobs/${job.token}`, tenant);
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: job.title, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    await navigator.clipboard?.writeText(url);
  }

  return (
    <div className="w-full min-w-0 px-4 py-6 min-[1000px]:px-8">
      <CandidatePageIntro
        eyebrow={companyName}
        title="Open Positions"
        subtitle="Find a published role that matches your background."
      />

      <form
        className="mb-6 flex items-center gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-[#012352] bg-white p-1">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border-r border-[#CBD5E1] px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#64748B]" aria-hidden />
            <span className="sr-only">Job title or keyword</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Job title or keyword"
              className="min-w-0 flex-1 bg-transparent text-xs text-black outline-none placeholder:text-[#94A3B8]"
            />
          </label>
          <label className="flex h-9 min-w-0 flex-1 items-center px-2.5">
            <span className="sr-only">Location</span>
            <input
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder="City, State, country, or remote, wfh"
              className="min-w-0 flex-1 bg-transparent text-xs text-black outline-none placeholder:text-[#94A3B8]"
            />
          </label>
          <button type="submit" className={`${CANDIDATE_BTN_NAVY} h-[30px] shrink-0 px-3 text-[10px]`}>
            Search
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#012352]"
            aria-label="Filter jobs"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          {filtersOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-lg">
              <label className="block text-[11px] font-medium text-[#6B7280]">
                Work type
                <select
                  value={employmentType}
                  onChange={(event) => onEmploymentTypeChange(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-[#CBD5E1] px-2 text-xs text-[#111827]"
                >
                  <option value="">Any</option>
                  <option value="W2">W2</option>
                  <option value="1099">1099</option>
                  <option value="Contract">Contract</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </form>

      {loading ? <p className="text-sm text-[#6B7280]">Loading open positions…</p> : null}
      {error ? <p className="text-sm text-[#B91C1C]">{error}</p> : null}

      {!loading && !error ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,387px)_minmax(0,1fr)]">
          <div>
            <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
                <p className="text-sm font-semibold text-[#111827]">
                  <span className="mr-1">{sorted.length}</span>
                  Jobs
                </p>
                <label className="relative">
                  <span className="sr-only">Sort jobs</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as "recent" | "pay")}
                    className="h-[30px] appearance-none rounded-lg border border-[#CBD5E1] bg-white py-1 pr-7 pl-2 text-xs text-[#111827]"
                  >
                    <option value="recent">Most recent</option>
                    <option value="pay">Highest pay</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {visible.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-[#6B7280]">No published roles match this search.</p>
                ) : (
                  visible.map((job) => {
                    const active = selected?.key === job.key;
                    return (
                      <button
                        key={job.key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(job.key);
                          setExpanded(true);
                        }}
                        className={`block w-full border-b border-[#F3F4F6] px-5 py-5 text-left ${
                          active ? "border-l-2 border-l-[color:var(--brand-primary,#BC8B41)] bg-white" : "hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <p className="text-sm font-semibold leading-5 text-[#012352]">{job.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-[#6B7280]">{companyName}</p>
                        <p className="mt-3 text-xs leading-4 text-[#6B7280]">{job.location}</p>
                        {job.postedLabel ? (
                          <p className="mt-1.5 text-xs leading-4 text-[#6B7280]">{job.postedLabel}</p>
                        ) : null}
                        {job.payLabel ? <p className="mt-1.5 text-xs leading-4 text-black">{job.payLabel}</p> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                className={CANDIDATE_BTN_OUTLINE}
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={CANDIDATE_BTN_NAVY}
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>

          <article className="min-w-0 rounded-xl border border-[#E5E7EB] bg-white">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#F3F4F6] px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[color:var(--brand-primary,#BC8B41)]">{companyName}</p>
                    <h2 className="mt-1 text-xl font-semibold leading-7 text-black">{selected.title}</h2>
                    <p className="text-sm text-[#6B7280]">{selected.location}</p>
                    <p className="mt-3 text-xs text-[#374151]">
                      {[selected.locationType, selected.employmentType].filter(Boolean).join(" · ")}
                      {selected.payLabel ? `  |  Pay Rate: ${selected.payLabel}` : ""}
                      {selected.postedLabel ? `  |  ${selected.postedLabel}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] text-[#012352]"
                      aria-label="Share job"
                      onClick={() => void shareJob(selected)}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={CANDIDATE_BTN_NAVY}
                      disabled={selected.applied}
                      onClick={() => onApply(selected.token)}
                    >
                      {selected.applied ? "Applied" : "Apply now"}
                    </button>
                    <a
                      href={applicationPath(`/jobs/${selected.token}`, tenant)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] text-[#012352]"
                      aria-label="Open public job"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
                <div className="space-y-4 px-5 py-4">
                  <DetailLine label="Job title" value={selected.title} />
                  <DetailLine label="Location" value={selected.locationType || selected.location} />
                  <DetailLine label="Employment type" value={selected.employmentType} />
                  <div className={expanded ? "" : "max-h-40 overflow-hidden"}>
                    <h3 className="text-sm font-semibold text-black">Overview</h3>
                    <JobDescriptionHtml
                      html={selected.descriptionHtml}
                      className="mt-2 text-sm leading-6 text-[#374151]"
                      emptyLabel="No description has been published for this role."
                    />
                    {selected.qualifications ? (
                      <>
                        <h3 className="mt-4 text-sm font-semibold text-black">Qualifications</h3>
                        <JobDescriptionHtml html={selected.qualifications} className="mt-2 text-sm leading-6 text-[#374151]" />
                      </>
                    ) : null}
                    {selected.responsibilities ? (
                      <>
                        <h3 className="mt-4 text-sm font-semibold text-black">Responsibilities</h3>
                        <JobDescriptionHtml html={selected.responsibilities} className="mt-2 text-sm leading-6 text-[#374151]" />
                      </>
                    ) : null}
                    {selected.benefits ? (
                      <>
                        <h3 className="mt-4 text-sm font-semibold text-black">Benefits</h3>
                        <JobDescriptionHtml html={selected.benefits} className="mt-2 text-sm leading-6 text-[#374151]" />
                      </>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-[#012352]"
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                </div>
              </>
            ) : (
              <p className="px-5 py-10 text-sm text-[#6B7280]">Select a role to see the description.</p>
            )}
          </article>
        </div>
      ) : null}
    </div>
  );
}
