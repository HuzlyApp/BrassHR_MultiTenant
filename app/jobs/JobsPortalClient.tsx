"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { JobDetailPanel } from "@/app/jobs/JobDetailPanel";
import { JobResultCard } from "@/app/jobs/JobResultCard";
import { JobsBoardFilters } from "@/app/jobs/JobsBoardFilters";
import { JobsBoardSortMenu } from "@/app/jobs/JobsBoardSortMenu";
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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

  const boardStateRef = useRef(boardState);
  useEffect(() => {
    boardStateRef.current = boardState;
  }, [boardState]);

  const lastHrefRef = useRef("");
  useEffect(() => {
    if (!tenant) return;
    lastHrefRef.current = buildJobsBoardHref({
      tenant,
      q: boardState.q,
      professionId: boardState.professionId,
      specialtyId: boardState.specialtyId,
      location: boardState.location,
      employmentType: boardState.employmentType,
      locationType: boardState.locationType,
      sort: boardState.sort,
      page: boardState.page,
      job: selectedToken ?? boardState.job,
      panel: mobileDetailOpen && !isDesktop ? "detail" : null,
    });
  }, [
    boardState,
    isDesktop,
    mobileDetailOpen,
    selectedToken,
    tenant,
  ]);

  const replaceBoardUrl = useCallback(
    (patch: BoardUrlPatch) => {
      if (!tenant) return;
      const current = boardStateRef.current;
      const href = buildJobsBoardHref({
        tenant,
        q: "q" in patch ? (patch.q ?? "") : current.q,
        professionId: "professionId" in patch ? (patch.professionId ?? "") : current.professionId,
        specialtyId: "specialtyId" in patch ? (patch.specialtyId ?? "") : current.specialtyId,
        location: "location" in patch ? (patch.location ?? "") : current.location,
        employmentType: "employmentType" in patch ? (patch.employmentType ?? "") : current.employmentType,
        locationType: "locationType" in patch ? (patch.locationType ?? "") : current.locationType,
        sort: "sort" in patch ? patch.sort! : current.sort,
        page: "page" in patch ? patch.page! : current.page,
        job: patch.job === undefined ? selectedToken ?? current.job : patch.job,
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
    [isDesktop, mobileDetailOpen, router, selectedToken, tenant]
  );
  const replaceBoardUrlRef = useRef(replaceBoardUrl);
  useEffect(() => {
    replaceBoardUrlRef.current = replaceBoardUrl;
  }, [replaceBoardUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = boardStateRef.current;
      if (queryDraft.trim() === current.q && locationDraft.trim() === current.location) return;
      replaceBoardUrlRef.current({
        q: queryDraft,
        location: locationDraft,
        page: 1,
        professionId: current.professionId,
        specialtyId: current.specialtyId,
        employmentType: current.employmentType,
        locationType: current.locationType,
      });
    }, JOBS_BOARD_INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [boardState.location, boardState.q, locationDraft, queryDraft]);

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

  const clearSecondary = useCallback(() => {
    if (!tenant) return;
    const current = boardStateRef.current;
    const nextState = {
      ...current,
      professionId: "",
      specialtyId: "",
      employmentType: "",
      locationType: "",
      page: 1,
    };
    boardStateRef.current = nextState;
    const href = buildJobsBoardHref({
      tenant,
      q: nextState.q,
      professionId: "",
      specialtyId: "",
      employmentType: "",
      locationType: "",
      location: nextState.location,
      sort: nextState.sort,
      page: 1,
      job: selectedToken ?? nextState.job,
      panel: mobileDetailOpen && !isDesktop ? "detail" : null,
    });
    lastHrefRef.current = href;
    router.replace(href, { scroll: false });
  }, [isDesktop, mobileDetailOpen, router, selectedToken, tenant]);

  const clearAllSearchAndFilters = () => {
    setQueryDraft("");
    setLocationDraft("");
    boardStateRef.current = {
      ...boardStateRef.current,
      q: "",
      location: "",
      professionId: "",
      specialtyId: "",
      employmentType: "",
      locationType: "",
      page: 1,
    };
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
    const current = boardStateRef.current;
    if (key === "professionId") {
      boardStateRef.current = { ...current, professionId: "", specialtyId: "", page: 1 };
      replaceBoardUrl({ professionId: "", specialtyId: "", page: 1 });
    } else if (key === "specialtyId") {
      boardStateRef.current = { ...current, specialtyId: "", page: 1 };
      replaceBoardUrl({ specialtyId: "", page: 1 });
    } else if (key === "employmentType") {
      boardStateRef.current = { ...current, employmentType: "", page: 1 };
      replaceBoardUrl({ employmentType: "", page: 1 });
    } else {
      boardStateRef.current = { ...current, locationType: "", page: 1 };
      replaceBoardUrl({ locationType: "", page: 1 });
    }
  };

  return (
    <main
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#F8FAFC] text-slate-900"
      style={{ "--brand-primary": primaryHex } as React.CSSProperties}
    >
      <header className="shrink-0 border-b border-slate-200/80 bg-white">
        <div className="h-1 w-full" style={{ backgroundColor: primaryHex }} />
        <div className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-6 min-[1280px]:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-primary)]">
                {companyName}
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">Open positions</h1>
              <p className="mt-0.5 text-sm text-slate-500">Find a published role that matches your background.</p>
            </div>
            <button
              type="button"
              data-testid="jobs-mobile-search-toggle"
              aria-expanded={mobileSearchOpen}
              aria-controls="jobs-board-filters"
              onClick={() => setMobileSearchOpen((open) => !open)}
              className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 motion-reduce:transition-none lg:hidden ${
                mobileSearchOpen
                  ? "border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#e2e8f0)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[color:var(--brand-primary)]"
                  : hasActiveFilters
                    ? "border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#e2e8f0)] bg-white text-[color:var(--brand-primary)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {mobileSearchOpen ? (
                <>
                  <span aria-hidden>×</span>
                  Hide
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    className="shrink-0"
                  >
                    <path
                      d="M2.5 4.5H13.5M4.5 8H11.5M6.5 11.5H9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  Search
                </>
              )}
              {hasActiveFilters && !mobileSearchOpen ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[color:var(--brand-primary)] ring-2 ring-white"
                  aria-hidden
                />
              ) : null}
              <span className="sr-only">
                {mobileSearchOpen ? "Hide search and filters" : "Show search and filters"}
              </span>
            </button>
          </div>
          <div
            id="jobs-board-filters"
            className={`mt-3 ${mobileSearchOpen ? "block" : "hidden"} lg:block`}
          >
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
              onSearch={() => {
                replaceBoardUrl({ q: queryDraft, location: locationDraft, page: 1 });
                if (!isDesktop) setMobileSearchOpen(false);
              }}
              onClearSecondary={clearSecondary}
              onRemoveChip={removeChip}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col px-3 py-3 sm:px-6 min-[1280px]:px-8">
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
          className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
        >
          <section
            data-testid="jobs-results-panel"
            aria-label="Job results"
            className={`min-h-0 w-full flex-col lg:flex lg:w-[min(100%,28rem)] lg:max-w-[42%] lg:flex-none lg:pr-4 xl:w-[38%] ${
              showMobileDetail ? "hidden" : "flex flex-1"
            }`}
          >
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="text-sm font-medium text-slate-700" aria-live="polite">
                {total} {total === 1 ? "job" : "jobs"}
              </p>
              <JobsBoardSortMenu
                value={boardState.sort}
                onChange={(sort) => replaceBoardUrl({ sort })}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:rounded-xl lg:border-slate-200/60 lg:shadow-none">
              <div
                ref={listScrollRef}
                className="jobs-board-scroll h-full min-h-0 overflow-y-auto"
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
            </div>
            <div className="flex shrink-0 gap-2 pt-3 sm:justify-center">
              <button
                type="button"
                disabled={boardState.page <= 1 || loading}
                onClick={() => replaceBoardUrl({ page: Math.max(1, boardState.page - 1) })}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[7.5rem]"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={boardState.page >= pageCount || loading}
                onClick={() => replaceBoardUrl({ page: Math.min(pageCount, boardState.page + 1) })}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:min-w-[7.5rem]"
              >
                Next
              </button>
            </div>
          </section>

          <section
            aria-label="Selected job details"
            className={`min-h-0 w-full flex-col bg-white lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200/80 ${
              showMobileDetail ? "fixed inset-0 z-40 flex lg:static lg:z-auto" : "hidden"
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
