"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { JobDetailPanel } from "@/app/jobs/JobDetailPanel";
import { JobResultCard } from "@/app/jobs/JobResultCard";
import { JobsBoardFilters } from "@/app/jobs/JobsBoardFilters";
import { NO_OPEN_POSITIONS_MESSAGE } from "@/lib/jobs/public-application-routing";
import {
  buildJobsBoardHref,
  buildPublicJobsApiSearchParams,
  hasActiveJobsBoardFilters,
  JOBS_BOARD_INPUT_DEBOUNCE_MS,
  parseJobsBoardSearchParams,
  PUBLIC_JOBS_DESKTOP_MIN_WIDTH,
  PUBLIC_JOBS_PAGE_SIZE,
  resolveSelectedJobToken,
  sortPublicBoardJobs,
  type JobsBoardActiveChip,
  type JobsBoardSort,
  type JobsBoardUrlState,
  type PublicBoardJob,
} from "@/lib/jobs/public-jobs-board";
import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";

type Option = { id: string; name: string; profession_id?: string };

type BoardUrlPatch = Partial<
  Pick<
    JobsBoardUrlState,
    | "q"
    | "professionId"
    | "specialtyId"
    | "location"
    | "employmentType"
    | "locationType"
    | "sort"
    | "page"
    | "job"
    | "panel"
  >
>;

function useIsDesktopBoard() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${PUBLIC_JOBS_DESKTOP_MIN_WIDTH}px)`);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

export default function JobsPortalClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const branding = useTenantBranding();
  const isDesktop = useIsDesktopBoard();
  const boardState = useMemo(() => parseJobsBoardSearchParams(searchParams), [searchParams]);
  const landedWithJobRef = useRef(Boolean(boardState.job));
  const listScrollRef = useRef<HTMLDivElement>(null);
  const savedListScrollRef = useRef(0);
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedTokenRef = useRef<string | null>(boardState.job);

  const [tenant, setTenant] = useState(
    () => searchParams.get("tenant")?.trim().toLowerCase() ?? ""
  );
  const [jobs, setJobs] = useState<PublicBoardJob[]>([]);
  const [professions, setProfessions] = useState<Option[]>([]);
  const [specialties, setSpecialties] = useState<Option[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [queryDraft, setQueryDraft] = useState(boardState.q);
  const [locationDraft, setLocationDraft] = useState(boardState.location);
  const [selectedToken, setSelectedToken] = useState<string | null>(boardState.job);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(boardState.panel === "detail");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    selectedTokenRef.current = selectedToken;
  }, [selectedToken]);

  useEffect(() => {
    const resolved = resolveTenantSlugForClient(window.location.search, {
      path: window.location.pathname,
    });
    setTenant(resolved.slug ?? "");
  }, [searchParams]);

  useEffect(() => {
    setQueryDraft(boardState.q);
    setLocationDraft(boardState.location);
  }, [boardState.q, boardState.location]);

  const lastHrefRef = useRef("");
  const replaceBoardUrl = useCallback(
    (patch: BoardUrlPatch) => {
      if (!tenant) return;
      const href = buildJobsBoardHref({
        tenant,
        q: patch.q ?? boardState.q,
        professionId: patch.professionId ?? boardState.professionId,
        specialtyId: patch.specialtyId ?? boardState.specialtyId,
        location: patch.location ?? boardState.location,
        employmentType: patch.employmentType ?? boardState.employmentType,
        locationType: patch.locationType ?? boardState.locationType,
        sort: patch.sort ?? boardState.sort,
        page: patch.page ?? boardState.page,
        job: patch.job === undefined ? selectedToken ?? boardState.job : patch.job,
        panel:
          patch.panel === undefined
            ? mobileDetailOpen && !isDesktop
              ? "detail"
              : null
            : patch.panel,
      });
      if (href === lastHrefRef.current) return;
      lastHrefRef.current = href;
      router.replace(href, { scroll: false });
    },
    [boardState, isDesktop, mobileDetailOpen, router, selectedToken, tenant]
  );
  const replaceBoardUrlRef = useRef(replaceBoardUrl);
  useEffect(() => {
    replaceBoardUrlRef.current = replaceBoardUrl;
  }, [replaceBoardUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (queryDraft.trim() === boardState.q && locationDraft.trim() === boardState.location) return;
      replaceBoardUrl({ q: queryDraft, location: locationDraft, page: 1 });
    }, JOBS_BOARD_INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [boardState.location, boardState.q, locationDraft, queryDraft, replaceBoardUrl]);

  useEffect(() => {
    if (!tenant) {
      setError("Open this page from your employer's tenant job portal.");
      setLoading(false);
      return;
    }
    const params = buildPublicJobsApiSearchParams({
      tenant,
      q: boardState.q,
      professionId: boardState.professionId,
      specialtyId: boardState.specialtyId,
      location: boardState.location,
      employmentType: boardState.employmentType,
      locationType: boardState.locationType,
      page: boardState.page,
      pageSize: PUBLIC_JOBS_PAGE_SIZE,
    });
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/public/jobs?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
        setJobs((payload.jobs ?? []) as PublicBoardJob[]);
        setTotal(payload.total ?? 0);
        setProfessions(payload.filters?.professions ?? []);
        setSpecialties(payload.filters?.specialties ?? []);
        setTenantName(payload.tenant?.name ?? "");
        setError("");
        listScrollRef.current?.scrollTo({ top: 0 });
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
        setJobs([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [
    boardState.employmentType,
    boardState.location,
    boardState.locationType,
    boardState.page,
    boardState.professionId,
    boardState.q,
    boardState.specialtyId,
    tenant,
  ]);

  useEffect(() => {
    if (loading) return;
    const urlJobInResults =
      boardState.job && jobs.some((job) => job.public_job_token === boardState.job)
        ? boardState.job
        : null;
    const preferred = urlJobInResults ?? selectedTokenRef.current;
    const resolved = resolveSelectedJobToken(jobs, preferred);
    setSelectedToken(resolved);
    if (resolved !== boardState.job) {
      replaceBoardUrlRef.current({ job: resolved });
    }
    if (!jobs.length) setMobileDetailOpen(false);
  }, [boardState.job, jobs, loading]);

  useEffect(() => {
    if (!isDesktop && landedWithJobRef.current && boardState.job) {
      setMobileDetailOpen(true);
    }
  }, [boardState.job, isDesktop]);

  useEffect(() => {
    if (mobileDetailOpen && !isDesktop) {
      backButtonRef.current?.focus();
    }
  }, [isDesktop, mobileDetailOpen, selectedToken]);

  const filteredSpecialties = useMemo(
    () => specialties.filter((item) => !boardState.professionId || item.profession_id === boardState.professionId),
    [boardState.professionId, specialties]
  );
  const visibleJobs = useMemo(
    () => sortPublicBoardJobs(jobs, boardState.sort, boardState.q),
    [boardState.q, boardState.sort, jobs]
  );
  const pageCount = Math.max(1, Math.ceil(total / PUBLIC_JOBS_PAGE_SIZE));
  const selectedJob = visibleJobs.find((job) => job.public_job_token === selectedToken) ?? null;
  const companyName = tenantName || branding.companyName;
  const hasActiveFilters = hasActiveJobsBoardFilters(boardState);
  const showMobileDetail = mobileDetailOpen && !isDesktop;
  const primaryHex = branding.primaryHex || "#0D9488";
  const emptyDetailsMessage = error
    ? "Jobs could not be loaded. Try again in a moment."
    : hasActiveFilters
      ? "No matching jobs. Clear filters or try a different search."
      : "There are no open positions to display yet.";

  const selectJob = (token: string, openMobileDetail: boolean) => {
    if (openMobileDetail && listScrollRef.current) {
      savedListScrollRef.current = listScrollRef.current.scrollTop;
    }
    selectedTokenRef.current = token;
    setSelectedToken(token);
    if (openMobileDetail) setMobileDetailOpen(true);
    replaceBoardUrl({
      job: token,
      panel: openMobileDetail && !isDesktop ? "detail" : null,
    });
    window.requestAnimationFrame(() => {
      selectedCardRef.current?.scrollIntoView({ block: "nearest" });
    });
  };

  const closeMobileDetail = () => {
    setMobileDetailOpen(false);
    replaceBoardUrl({ panel: null, job: selectedToken });
    window.requestAnimationFrame(() => {
      if (listScrollRef.current) listScrollRef.current.scrollTop = savedListScrollRef.current;
      selectedCardRef.current?.focus();
    });
  };

  const clearSecondary = () =>
    replaceBoardUrl({
      professionId: "",
      specialtyId: "",
      employmentType: "",
      locationType: "",
      page: 1,
    });

  const clearAllSearchAndFilters = () => {
    setQueryDraft("");
    setLocationDraft("");
    replaceBoardUrl({
      q: "",
      location: "",
      professionId: "",
      specialtyId: "",
      employmentType: "",
      locationType: "",
      page: 1,
    });
  };

  const removeChip = (key: JobsBoardActiveChip["key"]) => {
    if (key === "professionId") replaceBoardUrl({ professionId: "", specialtyId: "", page: 1 });
    else if (key === "specialtyId") replaceBoardUrl({ specialtyId: "", page: 1 });
    else if (key === "employmentType") replaceBoardUrl({ employmentType: "", page: 1 });
    else replaceBoardUrl({ locationType: "", page: 1 });
  };

  return (
    <main
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#F8FAFC] text-slate-900"
      style={{ "--brand-primary": primaryHex } as React.CSSProperties}
    >
      <header className="shrink-0 border-b border-slate-200/80 bg-white">
        <div className="h-1 w-full" style={{ backgroundColor: primaryHex }} />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-6 min-[1280px]:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-primary)]">
            {companyName}
          </p>
          <h1 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">Open positions</h1>
          <p className="mt-0.5 text-sm text-slate-500">Find a published role that matches your background.</p>
          <div className="mt-3">
            <JobsBoardFilters
              query={queryDraft}
              location={locationDraft}
              professionId={boardState.professionId}
              specialtyId={boardState.specialtyId}
              employmentType={boardState.employmentType}
              locationType={boardState.locationType}
              professions={professions}
              specialties={filteredSpecialties}
              onQueryChange={setQueryDraft}
              onLocationChange={setLocationDraft}
              onProfessionChange={(value) => replaceBoardUrl({ professionId: value, specialtyId: "", page: 1 })}
              onSpecialtyChange={(value) => replaceBoardUrl({ specialtyId: value, page: 1 })}
              onEmploymentTypeChange={(value) => replaceBoardUrl({ employmentType: value, page: 1 })}
              onLocationTypeChange={(value) => replaceBoardUrl({ locationType: value, page: 1 })}
              onSearch={() => replaceBoardUrl({ q: queryDraft, location: locationDraft, page: 1 })}
              onClearSecondary={clearSecondary}
              onRemoveChip={removeChip}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col px-4 py-3 sm:px-6 min-[1280px]:px-8">
        {error ? (
          <div
            role="alert"
            data-testid="jobs-error"
            className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </div>
        ) : null}

        <div
          data-testid="jobs-split-view"
          data-layout={isDesktop ? "split" : "stack"}
          className="flex min-h-0 flex-1 overflow-hidden lg:flex"
        >
          <section
            data-testid="jobs-results-panel"
            aria-label="Job results"
            className={`min-h-0 w-full flex-col lg:flex lg:w-[40%] lg:max-w-[42%] lg:pr-4 ${
              showMobileDetail ? "hidden" : "flex"
            }`}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700" aria-live="polite">
                {total} {total === 1 ? "job" : "jobs"}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <span className="sr-only">Sort jobs</span>
                <select
                  aria-label="Sort jobs"
                  value={boardState.sort}
                  onChange={(event) =>
                    replaceBoardUrl({ sort: event.target.value as JobsBoardSort })
                  }
                  className="min-h-11 rounded-lg border-0 bg-transparent text-sm text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_28%,transparent)]"
                >
                  <option value="recent">Most recent</option>
                  <option value="relevant">Most relevant</option>
                </select>
              </label>
            </div>
            <div
              ref={listScrollRef}
              className="jobs-board-scroll min-h-0 flex-1 overflow-y-auto pr-1"
            >
              {loading ? (
                <div data-testid="jobs-loading" className="space-y-2" aria-busy="true" aria-label="Loading jobs">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-xl bg-white motion-reduce:animate-none" />
                  ))}
                </div>
              ) : null}
              {!loading && !error && jobs.length === 0 ? (
                <div
                  data-testid="jobs-empty"
                  className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center"
                >
                  <p className="text-sm font-medium text-slate-800">
                    {hasActiveFilters ? "No jobs matched your search." : NO_OPEN_POSITIONS_MESSAGE}
                  </p>
                  {hasActiveFilters ? (
                    <>
                      <p className="mt-1 text-sm text-slate-500">
                        Try removing filters or changing the job title or location.
                      </p>
                      <button
                        type="button"
                        onClick={clearAllSearchAndFilters}
                        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {!loading && !error ? (
                <div className="divide-y divide-slate-100" role="listbox" aria-label="Open positions">
                  {visibleJobs.map((job) => {
                    const token = job.public_job_token;
                    const selected = token === selectedToken;
                    return (
                      <JobResultCard
                        key={token}
                        job={job}
                        companyName={companyName}
                        selected={selected}
                        buttonRef={selected ? (node) => { selectedCardRef.current = node; } : undefined}
                        onSelect={() => selectJob(token, !isDesktop)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 justify-center gap-3 pt-3">
              <button
                type="button"
                disabled={boardState.page <= 1 || loading}
                onClick={() => replaceBoardUrl({ page: Math.max(1, boardState.page - 1) })}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={boardState.page >= pageCount || loading}
                onClick={() => replaceBoardUrl({ page: Math.min(pageCount, boardState.page + 1) })}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>

          <div className="hidden w-px bg-slate-200 lg:block" aria-hidden />

          <section
            aria-label="Selected job details"
            className={`min-h-0 w-full flex-col bg-white lg:flex lg:w-[60%] lg:min-w-[58%] lg:rounded-2xl lg:border lg:border-slate-200/80 ${
              showMobileDetail ? "flex" : "hidden"
            }`}
          >
            <JobDetailPanel
              job={selectedJob}
              companyName={companyName}
              tenantSlug={tenant}
              stacked={!isDesktop}
              emptyMessage={!loading && jobs.length === 0 ? emptyDetailsMessage : undefined}
              onBack={closeMobileDetail}
              backButtonRef={(node) => {
                backButtonRef.current = node;
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
