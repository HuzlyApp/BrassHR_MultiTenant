"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WORKFLOW_CONFIG_PATH } from "@/lib/job-requisitions/types";

type JobRow = {
  id: string;
  title: string;
  job_role: string | null;
  employment_type: string;
  placement_type: string;
  location: string | null;
  department: string | null;
  status: string;
  workflow_template_id: string | null;
  workflow_name: string | null;
  workflow_status: string | null;
  workflow_assignment_error: string | null;
  public_job_token: string | null;
  applicant_count: number;
  created_at: string;
  pay_rate: number | null;
  bill_rate: number | null;
};

const STATUSES = ["All", "Draft", "Open", "Paused", "Closed", "Filled"] as const;

const emptyForm = {
  title: "",
  description: "",
  jobRole: "",
  employmentType: "W2",
  placementType: "Internal",
  department: "",
  location: "",
  facilityName: "",
  payRate: "",
  billRate: "",
  qualifications: "",
  targetStartDate: "",
};

export default function AdminRecruiterJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedApplicants, setSelectedApplicants] = useState<
    Array<{
      applicantId: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      status: string | null;
    }>
  >([]);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/admin/job-requisitions?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load jobs");
      setJobs([]);
    } else {
      setJobs(json.jobs ?? []);
      setError(null);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantSlugHint = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("tenant") ?? "";
  }, []);

  function applyLink(job: JobRow) {
    if (!job.public_job_token) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ job_token: job.public_job_token });
    if (tenantSlugHint) params.set("tenant", tenantSlugHint);
    return `${origin}/apply?${params.toString()}`;
  }

  async function saveJob(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const payload = {
      title: form.title,
      description: form.description || null,
      jobRole: form.jobRole,
      employmentType: form.employmentType,
      placementType: form.placementType,
      department: form.department || null,
      location: form.location || null,
      facilityName: form.facilityName || null,
      payRate: form.payRate || null,
      billRate: form.billRate || null,
      qualifications: form.qualifications || null,
      targetStartDate: form.targetStartDate || null,
      status: "Draft",
    };

    const res = await fetch(
      editingId ? `/api/admin/job-requisitions/${editingId}` : "/api/admin/job-requisitions",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save job");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setNotice(
      json.job?.workflow_template_id
        ? "Saved. Workflow assigned automatically."
        : json.job?.workflow_assignment_error ||
            "Saved as draft. Configure a workflow mapping before publishing."
    );
    await load();
  }

  async function setStatus(id: string, status: string) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/job-requisitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(
        json.code === "WORKFLOW_MAPPING_MISSING"
          ? `${json.error}`
          : json.error ?? "Failed to update job"
      );
      return;
    }
    setNotice(
      status === "Open"
        ? "Job published. Application link is ready to copy."
        : `Job marked ${status}.`
    );
    await load();
  }

  async function openApplicants(job: JobRow) {
    setSelectedJobTitle(job.title);
    const res = await fetch(`/api/admin/job-requisitions/${job.id}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load applicants");
      return;
    }
    setSelectedApplicants(json.applicants ?? []);
  }

  async function copyLink(job: JobRow) {
    const link = applyLink(job);
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedId(job.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function beginEdit(job: JobRow) {
    setEditingId(job.id);
    setForm({
      title: job.title,
      description: "",
      jobRole: job.job_role ?? "",
      employmentType: job.employment_type,
      placementType: job.placement_type,
      department: job.department ?? "",
      location: job.location ?? "",
      facilityName: "",
      payRate: job.pay_rate != null ? String(job.pay_rate) : "",
      billRate: job.bill_rate != null ? String(job.bill_rate) : "",
      qualifications: "",
      targetStartDate: "",
    });
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Job requisitions</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Workflows are assigned automatically from mapping rules. Recruiters cannot override them.
          </p>
        </div>
        <Link href={WORKFLOW_CONFIG_PATH} className="text-sm text-[#0f514e] hover:underline">
          Workflow configuration
        </Link>
      </div>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}{" "}
          {/workflow|mapping/i.test(error) ? (
            <Link href={WORKFLOW_CONFIG_PATH} className="underline">
              Open workflow configuration
            </Link>
          ) : null}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>
      ) : null}

      <section className="mb-8 rounded-lg border border-[#E2E8F0] p-4">
        <h2 className="text-sm font-semibold">
          {editingId ? "Edit draft job" : "Create draft job"}
        </h2>
        <form onSubmit={saveJob} className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ["title", "Title", "text", true],
              ["jobRole", "Job role", "text", true],
              ["department", "Department", "text", false],
              ["location", "Location", "text", false],
              ["facilityName", "Facility", "text", false],
              ["payRate", "Pay rate", "number", false],
              ["billRate", "Bill rate", "number", false],
              ["targetStartDate", "Target start date", "date", false],
            ] as const
          ).map(([key, label, type, required]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                type={type}
                required={required}
                className="mt-1 w-full rounded border px-3 py-2"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="text-sm">
            Employment type
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.employmentType}
              onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
            >
              <option value="W2">W2</option>
              <option value="1099">1099</option>
              <option value="Contract">Contract</option>
            </select>
          </label>
          <label className="text-sm">
            Placement type
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.placementType}
              onChange={(e) => setForm((f) => ({ ...f, placementType: e.target.value }))}
            >
              <option value="Internal">Internal</option>
              <option value="Recruit_and_Release">Recruit and Release</option>
              <option value="Recruit_and_EOR">Recruit and EOR</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Description
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="text-sm md:col-span-2">
            Qualifications
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={2}
              value={form.qualifications}
              onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
            />
          </label>
          <p className="md:col-span-2 text-xs text-[#64748B]">
            Assigned workflow is read-only and recalculated when you save based on role, employment
            type, and placement type.
          </p>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              className="rounded bg-[#0c918a] px-3 py-2 text-sm text-white"
            >
              {editingId ? "Update draft" : "Save draft"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Search title, role, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-lg border border-[#E2E8F0]">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Requisitions</h2>
        {loading ? (
          <p className="p-4 text-sm text-[#64748B]">Loading…</p>
        ) : !jobs.length ? (
          <p className="p-4 text-sm text-[#64748B]">
            No job requisitions yet. Create a draft above, then publish after workflow mappings are
            configured.
          </p>
        ) : (
          <ul className="divide-y">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-[#0F172A]">{job.title}</p>
                  <p className="text-[#64748B]">
                    {[job.job_role, job.employment_type, job.placement_type, job.location]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {job.status} · {job.applicant_count} applicant
                    {job.applicant_count === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Created {new Date(job.created_at).toLocaleDateString()}
                  </p>
                  {job.workflow_name ? (
                    <p className="text-xs text-[#0f514e]">
                      Workflow: {job.workflow_name}
                      {job.workflow_status ? ` (${job.workflow_status})` : ""}
                    </p>
                  ) : job.workflow_assignment_error ? (
                    <p className="text-xs text-amber-700">{job.workflow_assignment_error}</p>
                  ) : (
                    <p className="text-xs text-amber-700">No workflow assigned yet.</p>
                  )}
                  {job.status === "Open" && job.public_job_token ? (
                    <p className="break-all text-xs text-[#0f514e]">{applyLink(job)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.status === "Draft" || job.status === "Paused" ? (
                    <button
                      type="button"
                      onClick={() => beginEdit(job)}
                      className="rounded border px-3 py-1.5"
                    >
                      Edit
                    </button>
                  ) : null}
                  {job.status === "Draft" || job.status === "Paused" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(job.id, "Open")}
                      className="rounded border border-[#0c918a] px-3 py-1.5 text-[#0f514e]"
                    >
                      Publish
                    </button>
                  ) : null}
                  {job.status === "Open" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void copyLink(job)}
                        className="rounded border px-3 py-1.5"
                      >
                        {copiedId === job.id ? "Copied" : "Copy apply link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void setStatus(job.id, "Paused")}
                        className="rounded border px-3 py-1.5"
                      >
                        Pause
                      </button>
                      <button
                        type="button"
                        onClick={() => void setStatus(job.id, "Closed")}
                        className="rounded border px-3 py-1.5"
                      >
                        Close
                      </button>
                    </>
                  ) : null}
                  {job.status === "Closed" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(job.id, "Filled")}
                      className="rounded border px-3 py-1.5"
                    >
                      Archive / Mark filled
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void openApplicants(job)}
                    className="rounded border px-3 py-1.5"
                  >
                    View applicants
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedJobTitle ? (
        <section className="mt-6 rounded-lg border border-[#E2E8F0] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Applicants — {selectedJobTitle}</h2>
            <button
              type="button"
              className="text-xs text-[#64748B]"
              onClick={() => {
                setSelectedJobTitle(null);
                setSelectedApplicants([]);
              }}
            >
              Close
            </button>
          </div>
          {!selectedApplicants.length ? (
            <p className="text-sm text-[#64748B]">No applicants linked to this job yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {selectedApplicants.map((a) => (
                <li key={a.applicantId} className="flex items-center justify-between py-2">
                  <span>
                    {[a.firstName, a.lastName].filter(Boolean).join(" ") || "Unnamed"} ·{" "}
                    {a.email || "—"} · {a.status || "—"}
                  </span>
                  <Link
                    href={`/admin_recruiter/new/onboard-applicant/${a.applicantId}`}
                    className="text-[#0f514e] underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
