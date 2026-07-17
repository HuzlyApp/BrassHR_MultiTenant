"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { resolveTenantSlugForClient } from "@/lib/tenant/resolve-tenant-context";

type Job = {
  public_job_token: string;
  public_title: string;
  public_description: string;
  location: string;
  schedule: string | null;
  employment_type: string;
  published_at: string;
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

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="px-5 py-12 text-white sm:px-8" style={{ backgroundColor: branding.primaryHex }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">{branding.companyName}</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Find your next opportunity</h1>
          <p className="mt-3 max-w-2xl text-white/80">Explore current openings and apply directly with your resume.</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="-mt-14 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg md:grid-cols-2 lg:grid-cols-5">
          <input aria-label="Keyword" placeholder="Title or keyword" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <select aria-label="Profession" value={professionId} onChange={(e) => { setProfessionId(e.target.value); setSpecialtyId(""); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="">All professions</option>
            {professions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Specialty" value={specialtyId} onChange={(e) => { setSpecialtyId(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="">All specialties</option>
            {filteredSpecialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input aria-label="Location" placeholder="Location" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          <select aria-label="Employment type" value={employmentType} onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
            <option value="">All employment types</option>
            <option>W2</option><option>1099</option><option>Contract</option>
          </select>
        </section>

        <div className="mb-5 mt-8 flex items-center justify-between">
          <p className="text-sm text-slate-600">{total} published {total === 1 ? "job" : "jobs"}</p>
          <p className="text-sm text-slate-500">Page {page} of {pageCount}</p>
        </div>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {loading ? <div className="py-16 text-center text-sm text-slate-500">Loading opportunities…</div> : null}
        {!loading && !error ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <article key={job.public_job_token} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{job.public_title}</h2>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">{job.employment_type}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-600">{job.location}</p>
                <p className="mt-1 text-xs text-slate-500">{[relationName(job.professions), relationName(job.specialties), job.schedule].filter(Boolean).join(" · ")}</p>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{job.public_description}</p>
                <Link href={`/jobs/${encodeURIComponent(job.public_job_token)}?tenant=${encodeURIComponent(tenant)}`} className="mt-5 inline-flex font-semibold text-teal-700 hover:underline">
                  View job details
                </Link>
              </article>
            ))}
          </div>
        ) : null}
        {!loading && !error && jobs.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">No published jobs match your filters.</div> : null}

        <div className="mt-8 flex justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40">Previous</button>
          <button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40">Next</button>
        </div>
      </div>
    </main>
  );
}
