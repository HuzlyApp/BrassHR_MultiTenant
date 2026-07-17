"use client";

import { useCallback, useEffect, useState } from "react";

type ApplicationRow = {
  id: string;
  status: string;
  created_at: string;
  job_requisition_id: string;
  workflow_id: string;
  applicant_workflow_instance_id: string;
  job_requisitions: Record<string, unknown> | Record<string, unknown>[] | null;
  onboarding_flows: Record<string, unknown> | Record<string, unknown>[] | null;
  applicant_profiles: Record<string, unknown> | Record<string, unknown>[] | null;
};

function one(value: Record<string, unknown> | Record<string, unknown>[] | null) {
  return Array.isArray(value) ? value[0] ?? {} : value ?? {};
}

export default function JobApplicationsPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [status, setStatus] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const initialJobId = new URLSearchParams(window.location.search).get("jobId")?.trim();
    if (initialJobId) setJobId(initialJobId);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (jobId) params.set("jobId", jobId);
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/job-applications?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load applications");
      setRows(payload.applications ?? []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [jobId, status]);

  useEffect(() => void load(), [load]);

  return (
    <main className="p-5 sm:p-8">
      <p className="text-sm font-medium text-teal-700">Recruiting</p>
      <h1 className="text-2xl font-semibold text-slate-900">Job applications</h1>
      <div className="mt-5 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="Job requisition ID" className="min-w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="in_progress">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="rejected">Rejected</option>
          <option value="hired">Hired</option>
        </select>
      </div>
      {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Job</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Workflow</th><th className="px-4 py-3">Date applied</th><th className="px-4 py-3">References</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading applications…</td></tr> : rows.map((row) => {
              const applicant = one(row.applicant_profiles);
              const job = one(row.job_requisitions);
              const workflow = one(row.onboarding_flows);
              const name = [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") || String(applicant.email ?? "Applicant");
              return <tr key={row.id}><td className="px-4 py-4"><p className="font-medium text-slate-900">{name}</p><p className="text-xs text-slate-500">{String(applicant.email ?? "")}</p></td><td className="px-4 py-4">{String(job.public_title ?? row.job_requisition_id)}</td><td className="px-4 py-4 capitalize">{row.status.replace("_", " ")}</td><td className="px-4 py-4">{String(workflow.name ?? row.workflow_id)}</td><td className="px-4 py-4">{new Date(row.created_at).toLocaleDateString()}</td><td className="px-4 py-4 text-xs text-slate-500"><span className="block">Job: {row.job_requisition_id}</span><span className="block">Workflow: {row.workflow_id}</span><span className="block">Instance: {row.applicant_workflow_instance_id}</span></td></tr>;
            })}
            {!loading && rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No applications match these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
