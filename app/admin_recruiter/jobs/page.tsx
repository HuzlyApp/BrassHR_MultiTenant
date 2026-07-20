"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type JobRow = {
  id: string;
  internal_requisition_number: string | null;
  public_title: string | null;
  employment_type: string;
  status: "draft" | "published" | "closed" | "archived";
  created_at: string;
  published_at: string | null;
  professions: { name?: string } | { name?: string }[] | null;
  specialties: { name?: string } | { name?: string }[] | null;
  onboarding_flows: { name?: string } | { name?: string }[] | null;
  job_applications: { count?: number }[] | null;
};

function relationName(value: JobRow["professions"]): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? "—";
}

const statusStyles: Record<JobRow["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  closed: "bg-amber-100 text-amber-800",
  archived: "bg-violet-100 text-violet-800",
};

export default function AdminRecruiterJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [status, setStatus] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (employmentType) params.set("employmentType", employmentType);
    try {
      const response = await fetch(`/api/admin/jobs?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
      setJobs(payload.jobs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [employmentType, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(jobId: string, action: "unpublish" | "close" | "archive") {
    const response = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Failed to update job");
      return;
    }
    await load();
  }

  return (
    <main className="p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Recruiting</p>
          <h1 className="text-2xl font-semibold text-slate-900">Job requisitions</h1>
          <p className="mt-1 text-sm text-slate-500">Manage drafts, published jobs, and application activity.</p>
        </div>
        <Link href="/admin_recruiter/jobs/new" className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
          Create job requisition
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
        <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All employment types</option>
          <option>W2</option>
          <option>1099</option>
          <option>Contract</option>
        </select>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Requisition / title</th>
              <th className="px-4 py-3">Profession</th>
              <th className="px-4 py-3">Employment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned workflow</th>
              <th className="px-4 py-3">Applicants</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading jobs…</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No job requisitions match these filters.</td></tr>
            ) : jobs.map((job) => (
              <tr key={job.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-900">{job.public_title || "Untitled draft"}</p>
                  <p className="mt-1 text-xs text-slate-500">{job.internal_requisition_number || job.id.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {relationName(job.professions)}
                  <span className="block text-xs text-slate-500">{relationName(job.specialties)}</span>
                </td>
                <td className="px-4 py-4 text-slate-700">{job.employment_type}</td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[job.status]}`}>{job.status}</span></td>
                <td className="px-4 py-4 text-slate-700">{relationName(job.onboarding_flows)}</td>
                <td className="px-4 py-4 font-medium text-slate-800">
                  <Link href={`/admin_recruiter/applications?jobId=${job.id}`} className="text-teal-700 hover:underline">
                    {job.job_applications?.[0]?.count ?? 0}
                  </Link>
                </td>
                <td className="px-4 py-4 text-slate-600">{new Date(job.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {(job.status === "draft" || job.status === "published") ? (
                      <Link href={`/admin_recruiter/jobs/${job.id}/edit`} className="text-xs font-medium text-slate-700 hover:underline">Edit</Link>
                    ) : null}
                    {job.status === "published" ? (
                      <>
                        <button onClick={() => void transition(job.id, "unpublish")} className="text-xs font-medium text-teal-700 hover:underline">Unpublish</button>
                        <button onClick={() => void transition(job.id, "close")} className="text-xs font-medium text-amber-700 hover:underline">Close</button>
                      </>
                    ) : null}
                    {job.status !== "archived" ? (
                      <button onClick={() => void transition(job.id, "archive")} className="text-xs font-medium text-violet-700 hover:underline">Archive</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
