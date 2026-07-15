"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PublicJob = {
  id: string;
  jobNumber: string | null;
  title: string;
  description: string | null;
  profession: string | null;
  specialty: string | null;
  location: string | null;
  locationType: string | null;
  city: string | null;
  stateProvince: string | null;
  employmentType: string;
  benefitsSummary: string | null;
  payRate: number | null;
  rateUnit: string | null;
  currency: string | null;
  publicJobToken: string | null;
  qualifications: string | null;
  targetStartDate: string | null;
};

export default function PublicJobsSearchPage() {
  const searchParams = useSearchParams();
  const tenantFromQuery = searchParams.get("tenant")?.trim() ?? "";
  const [tenant, setTenant] = useState(tenantFromQuery);
  const [q, setQ] = useState("");
  const [profession, setProfession] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [locationType, setLocationType] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tenant.trim()) {
      setJobs([]);
      setError("Enter an organization slug to search jobs.");
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ tenant: tenant.trim().toLowerCase() });
    if (q.trim()) params.set("q", q.trim());
    if (profession.trim()) params.set("profession", profession.trim());
    if (specialty.trim()) params.set("specialty", specialty.trim());
    if (locationType) params.set("locationType", locationType);
    if (employmentType) params.set("employmentType", employmentType);

    const res = await fetch(`/api/public/jobs?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.message ?? json.error ?? "Failed to load jobs");
      setJobs([]);
      return;
    }
    setJobs(json.jobs ?? []);
    setTenantName(json.tenantName ?? null);
  }, [tenant, q, profession, specialty, locationType, employmentType]);

  useEffect(() => {
    if (tenantFromQuery) void load();
  }, [tenantFromQuery, load]);

  const applyHref = useMemo(() => {
    return (job: PublicJob) => {
      const params = new URLSearchParams();
      if (job.publicJobToken) params.set("job_token", job.publicJobToken);
      else params.set("job_id", job.id);
      if (tenant.trim()) params.set("tenant", tenant.trim().toLowerCase());
      return `/apply?${params.toString()}`;
    };
  }, [tenant]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[#0F172A]">
          {tenantName ? `Careers at ${tenantName}` : "Job search"}
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Search published openings by title, profession, specialty, or Job ID.
        </p>
      </header>

      <form
        className="mb-6 grid gap-3 rounded-lg border border-[#E2E8F0] p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="text-sm md:col-span-2">
          Organization
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            placeholder="tenant-slug"
            required
          />
        </label>
        <label className="text-sm md:col-span-2">
          Keywords / Job ID
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="JOB-2026-000001 or nurse"
          />
        </label>
        <label className="text-sm">
          Profession
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Specialty
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Location type
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
          >
            <option value="">Any</option>
            <option value="On-site">On-site</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </label>
        <label className="text-sm">
          Employment type
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
          >
            <option value="">Any</option>
            <option value="W2">W2</option>
            <option value="1099">1099</option>
            <option value="Contract">Contract</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded bg-[#0c918a] px-4 py-2 text-sm text-white"
            disabled={loading}
          >
            {loading ? "Searching…" : "Search jobs"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error}</p>
      ) : null}

      {!loading && !jobs.length && !error ? (
        <p className="text-sm text-[#64748B]">No published jobs matched your search.</p>
      ) : null}

      <ul className="space-y-4">
        {jobs.map((job) => (
          <li key={job.id} className="rounded-lg border border-[#E2E8F0] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono text-[#64748B]">{job.jobNumber}</p>
                <h2 className="text-lg font-semibold text-[#0F172A]">{job.title}</h2>
                <p className="mt-1 text-sm text-[#64748B]">
                  {[
                    job.profession,
                    job.specialty,
                    job.locationType,
                    [job.city, job.stateProvince].filter(Boolean).join(", ") || job.location,
                    job.employmentType,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {job.payRate != null ? (
                  <p className="mt-1 text-sm text-[#0f514e]">
                    {job.currency ?? "USD"} {job.payRate}
                    {job.rateUnit ? ` / ${job.rateUnit}` : ""}
                  </p>
                ) : null}
                {job.description ? (
                  <p className="mt-3 line-clamp-3 text-sm text-[#334155]">{job.description}</p>
                ) : null}
              </div>
              <Link
                href={applyHref(job)}
                className="rounded bg-[#0c918a] px-3 py-2 text-sm text-white"
              >
                Apply
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
