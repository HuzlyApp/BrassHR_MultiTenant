"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  buildApplyPath,
  NO_OPEN_POSITIONS_MESSAGE,
  normalizeJobToken,
  publicJobDisplayTitle,
} from "@/lib/jobs/public-application-routing";
import { formatPublicJobPayRate } from "@/lib/jobs/format-public-job-pay-rate";
import { jobDescriptionPlainText } from "@/lib/jobs/job-description-html";
import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";

type Job = {
  public_job_token: string;
  public_title: string;
  source_job_title?: string | null;
  source_type?: string | null;
  public_description: string;
  location: string;
  schedule: string | null;
  employment_type: string;
  published_at: string;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  pay_rate?: number | null;
  pay_rate_period?: string | null;
  rate_unit?: string | null;
  compensation_type?: string | null;
  show_pay_by?: string | null;
  professions: { name?: string } | { name?: string }[] | null;
  specialties: { name?: string } | { name?: string }[] | null;
};
type Option = { id: string; name: string; profession_id?: string };

function relationName(value: Job["professions"]): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? "";
}

export default function JobsPortalClient() {
  const searchParams = useSearchParams();
  const branding = useTenantBranding();
  const [tenant, setTenant] = useState(() => searchParams.get("tenant")?.trim().toLowerCase() ?? "");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [professions, setProfessions] = useState<Option[]>([]);
  const [specialties, setSpecialties] = useState<Option[]>([]);
  const [query, setQuery] = useState("");
  const [professionId, setProfessionId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 9;
  const hasActiveFilters = Boolean(query || professionId || specialtyId || location || employmentType);

  useEffect(() => {
    const resolved = resolveTenantSlugForClient(window.location.search, {
      path: window.location.pathname,
    });
    setTenant(resolved.slug ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!tenant) {
      setError("Open this page from your employer's tenant job portal.");
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ tenant, page: String(page), pageSize: String(pageSize) });
    if (query) params.set("q", query);
    if (professionId) params.set("professionId", professionId);
    if (specialtyId) params.set("specialtyId", specialtyId);
    if (location) params.set("location", location);
    if (employmentType) params.set("employmentType", employmentType);

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/public/jobs?${params}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
          setJobs(payload.jobs ?? []);
          setTotal(payload.total ?? 0);
          setProfessions(payload.filters?.professions ?? []);
          setSpecialties(payload.filters?.specialties ?? []);
          setError("");
        })
        .catch((loadError) => {
          if (loadError instanceof DOMException && loadError.name === "AbortError") return;
          setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [employmentType, location, page, professionId, query, specialtyId, tenant]);

  const filteredSpecialties = useMemo(
    () => specialties.filter((item) => !professionId || item.profession_id === professionId),
    [professionId, specialties]
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const primaryHex = branding.primaryHex || "#0D9488";
  const filterInputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_16%,transparent)]";
  const filterSelectClass = `${filterInputClass} cursor-pointer appearance-none bg-[length:16px_16px] bg-[position:right_10px_center] bg-no-repeat pr-9 bg-[url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')}")`;

  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{ "--brand-primary": primaryHex } as React.CSSProperties}
    >
      <header className="px-5 py-12 text-white sm:px-8" style={{ backgroundColor: primaryHex }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">{branding.companyName}</p>
          <h1
            className="mt-2 text-3xl font-semibold !text-white sm:text-4xl"
            style={{ color: "#ffffff" }}
          >
            Open positions
          </h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Browse published roles and apply to the position that matches your background.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="-mt-14 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg md:grid-cols-2 lg:grid-cols-5">
          <input aria-label="Keyword" placeholder="Title or keyword" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className={filterInputClass} />
          <select aria-label="Profession" value={professionId} onChange={(e) => { setProfessionId(e.target.value); setSpecialtyId(""); setPage(1); }} className={filterSelectClass}>
            <option value="">All professions</option>
            {professions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Specialty" value={specialtyId} onChange={(e) => { setSpecialtyId(e.target.value); setPage(1); }} className={filterSelectClass}>
            <option value="">All specialties</option>
            {filteredSpecialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input aria-label="Location" placeholder="Location" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} className={filterInputClass} />
          <select aria-label="Employment type" value={employmentType} onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }} className={filterSelectClass}>
            <option value="">All employment types</option>
            <option>W2</option><option>1099</option><option>Contract</option>
          </select>
        </section>

        <div className="mb-5 mt-8 flex items-center justify-between">
          <p className="text-sm text-slate-600">{total} open {total === 1 ? "position" : "positions"}</p>
          <p className="text-sm text-slate-500">Page {page} of {pageCount}</p>
        </div>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {loading ? <div className="py-16 text-center text-sm text-slate-500">Loading opportunities…</div> : null}
        {!loading && !error ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => {
              const profession = relationName(job.professions);
              const specialty = relationName(job.specialties);
              const displayTitle = publicJobDisplayTitle(job);
              const jobToken = normalizeJobToken(job.public_job_token);
              const applyHref = jobToken ? buildApplyPath(tenant, jobToken) : null;
              const payRate = formatPublicJobPayRate(job);
              return (
                <article key={job.public_job_token || displayTitle} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{displayTitle}</h2>
                    <span className="rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-primary)]">
                      {job.employment_type}
                    </span>
                  </div>
                  {profession ? <p className="mt-2 text-sm font-medium text-slate-700">{profession}</p> : null}
                  {specialty ? <p className="mt-1 text-sm text-slate-600">{specialty}</p> : null}
                  <p className="mt-2 text-sm font-medium text-slate-600">{job.location}</p>
                  {payRate ? (
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-medium text-slate-500">Pay Rate :</span>{" "}
                      <span className="font-semibold text-slate-900">{payRate}</span>
                    </p>
                  ) : null}
                  <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
                    {jobDescriptionPlainText(job.public_description || "")}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {applyHref ? (
                      <Link
                        href={applyHref}
                        className="inline-flex rounded-lg bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                      >
                        Apply
                      </Link>
                    ) : null}
                    {jobToken ? (
                      <Link
                        href={`/jobs/${encodeURIComponent(jobToken)}?tenant=${encodeURIComponent(tenant)}`}
                        className="text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
                      >
                        View details
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {!loading && !error && jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-600">
            {hasActiveFilters
              ? "No published jobs match your filters."
              : NO_OPEN_POSITIONS_MESSAGE}
          </div>
        ) : null}

        <div className="mt-8 flex justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">Previous</button>
          <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">Next</button>
        </div>
      </div>
    </main>
  );
}
