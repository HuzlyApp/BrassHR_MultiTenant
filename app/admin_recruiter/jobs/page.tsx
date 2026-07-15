"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WORKFLOW_CONFIG_PATH } from "@/lib/job-requisitions/types";

type JobRow = {
  id: string;
  job_number: string | null;
  title: string;
  job_role: string | null;
  profession: string | null;
  specialty: string | null;
  employment_type: string;
  placement_type: string;
  source_type?: string;
  location: string | null;
  location_type: string | null;
  department: string | null;
  status: string;
  workflow_template_id: string | null;
  workflow_name: string | null;
  workflow_status: string | null;
  workflow_assignment_error: string | null;
  public_job_token: string | null;
  applicant_count: number;
  positions_count: number;
  filled_positions: number;
  remaining_positions: number;
  created_at: string;
  pay_rate: number | null;
  bill_rate: number | null;
  msp_name: string | null;
  msp_client_name: string | null;
  external_req_id: string | null;
  eor_tenant_id: string | null;
};

type MspOption = { id: string; name: string; code: string | null };
type Metrics = {
  draft: number;
  pendingApproval: number;
  published: number;
  paused: number;
  openPositions: number;
  filledPositions: number;
  totalApplicants: number;
};

const STATUSES = [
  "All",
  "Draft",
  "Pending_Approval",
  "Approved",
  "Published",
  "Paused",
  "Closed",
  "Filled",
  "Cancelled",
] as const;

const emptyForm = {
  title: "",
  description: "",
  profession: "",
  specialty: "",
  employmentType: "W2",
  placementType: "Internal",
  sourceType: "Internal",
  department: "",
  location: "",
  locationType: "On-site",
  facilityName: "",
  city: "",
  addressLine1: "",
  payRate: "",
  billRate: "",
  rateUnit: "Hour",
  positionsCount: "1",
  qualifications: "",
  targetStartDate: "",
  mspId: "",
  mspName: "",
  mspClientName: "",
  externalReqId: "",
  sourceJobTitle: "",
  sourceJobUrl: "",
  eorTenantId: "",
};

export default function AdminRecruiterJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [msps, setMsps] = useState<MspOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  const isMsp = form.sourceType === "MSP" || form.placementType !== "Internal";
  const isEor = form.placementType === "Recruit_and_EOR";
  const isRemote = form.locationType === "Remote";

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
      setMetrics(null);
    } else {
      setJobs(json.jobs ?? []);
      setMetrics(json.metrics ?? null);
      setError(null);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetch("/api/admin/msps", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setMsps(json.msps ?? []))
      .catch(() => setMsps([]));
  }, []);

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

  function publicJobLink(job: JobRow) {
    if (!job.public_job_token) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ job_token: job.public_job_token });
    if (tenantSlugHint) params.set("tenant", tenantSlugHint);
    return `${origin}/jobs?${params.toString()}`;
  }

  function onPlacementChange(placementType: string) {
    const sourceType = placementType === "Internal" ? "Internal" : "MSP";
    setForm((f) => ({
      ...f,
      placementType,
      sourceType,
      ...(sourceType === "Internal"
        ? {
            mspId: "",
            mspName: "",
            mspClientName: "",
            externalReqId: "",
            sourceJobTitle: "",
            sourceJobUrl: "",
            eorTenantId: "",
          }
        : {}),
      ...(placementType !== "Recruit_and_EOR" ? { eorTenantId: "" } : {}),
    }));
  }

  async function saveJob(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = {
      title: form.title,
      description: form.description || null,
      profession: form.profession,
      specialty: form.specialty || null,
      jobRole: form.profession,
      employmentType: form.employmentType,
      placementType: form.placementType,
      sourceType: form.sourceType,
      department: form.department || null,
      location: form.location || null,
      locationType: form.locationType,
      facilityName: form.facilityName || null,
      city: form.city || null,
      addressLine1: isRemote ? null : form.addressLine1 || null,
      payRate: form.payRate || null,
      billRate: form.billRate || null,
      rateUnit: form.rateUnit,
      positionsCount: form.positionsCount || "1",
      qualifications: form.qualifications || null,
      targetStartDate: form.targetStartDate || null,
      mspId: isMsp ? form.mspId || null : null,
      mspName: isMsp
        ? form.mspName || msps.find((m) => m.id === form.mspId)?.name || null
        : null,
      mspClientName: isMsp ? form.mspClientName || null : null,
      externalReqId: isMsp ? form.externalReqId || null : null,
      sourceJobTitle: isMsp ? form.sourceJobTitle || null : null,
      sourceJobUrl: isMsp ? form.sourceJobUrl || null : null,
      eorTenantId: isEor ? form.eorTenantId || null : null,
      status: "Draft",
      idempotencyKey: editingId ? null : `create-${form.title}-${Date.now()}`,
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
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save job");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setNotice(
      json.job?.workflow_template_id
        ? `Saved ${json.job.job_number ?? ""}. Workflow assigned automatically.`
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
      status === "Published"
        ? "Job published. Application link is ready to copy."
        : `Job marked ${status}.`
    );
    await load();
  }

  async function duplicateJob(id: string) {
    const res = await fetch(`/api/admin/job-requisitions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to duplicate");
      return;
    }
    setNotice(`Duplicated as ${json.job?.job_number ?? "draft"}.`);
    await load();
  }

  async function openApplicants(job: JobRow) {
    setSelectedJobTitle(`${job.job_number ?? ""} ${job.title}`.trim());
    const res = await fetch(`/api/admin/job-requisitions/${job.id}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load applicants");
      return;
    }
    setSelectedApplicants(json.applicants ?? []);
  }

  async function copyLink(job: JobRow, kind: "apply" | "public") {
    const link = kind === "apply" ? applyLink(job) : publicJobLink(job);
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedId(`${job.id}-${kind}`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function beginEdit(job: JobRow) {
    setEditingId(job.id);
    setForm({
      ...emptyForm,
      title: job.title,
      profession: job.profession ?? job.job_role ?? "",
      specialty: job.specialty ?? "",
      employmentType: job.employment_type,
      placementType: job.placement_type,
      sourceType: job.source_type ?? (job.placement_type === "Internal" ? "Internal" : "MSP"),
      department: job.department ?? "",
      location: job.location ?? "",
      locationType: job.location_type ?? "On-site",
      payRate: job.pay_rate != null ? String(job.pay_rate) : "",
      billRate: job.bill_rate != null ? String(job.bill_rate) : "",
      positionsCount: String(job.positions_count ?? 1),
      mspName: job.msp_name ?? "",
      mspClientName: job.msp_client_name ?? "",
      externalReqId: job.external_req_id ?? "",
      eorTenantId: job.eor_tenant_id ?? "",
    });
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Job requisitions</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Workflows are assigned automatically from mapping rules. MSP and EOR fields appear when
            required.
          </p>
        </div>
        <Link href={WORKFLOW_CONFIG_PATH} className="text-sm text-[#0f514e] hover:underline">
          Workflow configuration
        </Link>
      </div>

      {metrics ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Draft", metrics.draft],
              ["Pending approval", metrics.pendingApproval],
              ["Published", metrics.published],
              ["Paused", metrics.paused],
              ["Open positions", metrics.openPositions],
              ["Filled positions", metrics.filledPositions],
              ["Applicants", metrics.totalApplicants],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[#E2E8F0] px-4 py-3">
              <p className="text-xs text-[#64748B]">{label}</p>
              <p className="text-lg font-semibold text-[#0F172A]">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

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
          <fieldset className="md:col-span-2 rounded border border-[#E2E8F0] p-3">
            <legend className="px-1 text-xs font-semibold text-[#64748B]">Basic Information</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Title
                <input
                  required
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Positions
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.positionsCount}
                  onChange={(e) => setForm((f) => ({ ...f, positionsCount: e.target.value }))}
                />
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
            </div>
          </fieldset>

          <fieldset className="md:col-span-2 rounded border border-[#E2E8F0] p-3">
            <legend className="px-1 text-xs font-semibold text-[#64748B]">
              Profession and Specialty
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Profession
                <input
                  required
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.profession}
                  onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Specialty
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="md:col-span-2 rounded border border-[#E2E8F0] p-3">
            <legend className="px-1 text-xs font-semibold text-[#64748B]">
              Employment and Placement
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
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
                  onChange={(e) => onPlacementChange(e.target.value)}
                >
                  <option value="Internal">Internal</option>
                  <option value="Recruit_and_Release">Recruit and Release</option>
                  <option value="Recruit_and_EOR">Recruit and EOR</option>
                </select>
              </label>
              {isEor ? (
                <label className="text-sm md:col-span-2">
                  Employer of Record (tenant ID)
                  <input
                    required={isEor}
                    className="mt-1 w-full rounded border px-3 py-2"
                    placeholder="EOR tenant UUID (current tenant allowed)"
                    value={form.eorTenantId}
                    onChange={(e) => setForm((f) => ({ ...f, eorTenantId: e.target.value }))}
                  />
                </label>
              ) : null}
            </div>
          </fieldset>

          {isMsp ? (
            <fieldset className="md:col-span-2 rounded border border-[#E2E8F0] p-3">
              <legend className="px-1 text-xs font-semibold text-[#64748B]">
                MSP Source Details
              </legend>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  MSP
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.mspId}
                    onChange={(e) => {
                      const msp = msps.find((m) => m.id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        mspId: e.target.value,
                        mspName: msp?.name ?? "",
                      }));
                    }}
                  >
                    <option value="">Select MSP…</option>
                    {msps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  MSP client
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.mspClientName}
                    onChange={(e) => setForm((f) => ({ ...f, mspClientName: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Source Job Requisition Number
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.externalReqId}
                    onChange={(e) => setForm((f) => ({ ...f, externalReqId: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  Source Job Title
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.sourceJobTitle}
                    onChange={(e) => setForm((f) => ({ ...f, sourceJobTitle: e.target.value }))}
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Source Job URL
                  <input
                    type="url"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.sourceJobUrl}
                    onChange={(e) => setForm((f) => ({ ...f, sourceJobUrl: e.target.value }))}
                  />
                </label>
              </div>
            </fieldset>
          ) : null}

          <fieldset className="md:col-span-2 rounded border border-[#E2E8F0] p-3">
            <legend className="px-1 text-xs font-semibold text-[#64748B]">Location</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Location type
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.locationType}
                  onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value }))}
                >
                  <option value="On-site">On-site</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </label>
              <label className="text-sm">
                Location label
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              {!isRemote ? (
                <label className="text-sm md:col-span-2">
                  Street address
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={form.addressLine1}
                    onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                  />
                </label>
              ) : null}
              <label className="text-sm">
                City
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Facility
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.facilityName}
                  onChange={(e) => setForm((f) => ({ ...f, facilityName: e.target.value }))}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="md:col-span-2 rounded border border-[#E2E8F0] p-3">
            <legend className="px-1 text-xs font-semibold text-[#64748B]">Compensation</legend>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                Pay rate
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.payRate}
                  onChange={(e) => setForm((f) => ({ ...f, payRate: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Bill rate
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.billRate}
                  onChange={(e) => setForm((f) => ({ ...f, billRate: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                Rate unit
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={form.rateUnit}
                  onChange={(e) => setForm((f) => ({ ...f, rateUnit: e.target.value }))}
                >
                  <option value="Hour">Hour</option>
                  <option value="Day">Day</option>
                  <option value="Week">Week</option>
                  <option value="Month">Month</option>
                  <option value="Year">Year</option>
                  <option value="Flat">Flat</option>
                </select>
              </label>
            </div>
          </fieldset>

          <label className="text-sm md:col-span-2">
            Qualifications
            <textarea
              className="mt-1 w-full rounded border px-3 py-2"
              rows={2}
              value={form.qualifications}
              onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Target start date
            <input
              type="date"
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.targetStartDate}
              onChange={(e) => setForm((f) => ({ ...f, targetStartDate: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Department
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            />
          </label>

          <p className="md:col-span-2 text-xs text-[#64748B]">
            Assigned workflow recalculates on save from profession, specialty, employment type,
            placement type, and job source.
          </p>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-[#0c918a] px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Update draft" : "Save draft"}
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
          placeholder="Search Job ID, title, MSP, source req…"
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
              {s.replace("_", " ")}
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
              <li
                key={job.id}
                className="flex flex-col gap-3 p-4 text-sm md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-[#0F172A]">
                    <span className="mr-2 font-mono text-xs text-[#64748B]">
                      {job.job_number ?? "—"}
                    </span>
                    {job.title}
                  </p>
                  <p className="text-[#64748B]">
                    {[
                      job.profession ?? job.job_role,
                      job.specialty,
                      job.employment_type,
                      job.placement_type,
                      job.location_type,
                      job.location,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {job.status} · {job.filled_positions ?? 0}/{job.positions_count ?? 1} filled ·{" "}
                    {job.applicant_count} applicant
                    {job.applicant_count === 1 ? "" : "s"}
                  </p>
                  {job.external_req_id ? (
                    <p className="text-xs text-[#64748B]">
                      Source req {job.external_req_id}
                      {job.msp_name ? ` · ${job.msp_name}` : ""}
                      {job.msp_client_name ? ` · ${job.msp_client_name}` : ""}
                    </p>
                  ) : null}
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
                  {job.status === "Published" && job.public_job_token ? (
                    <p className="break-all text-xs text-[#0f514e]">{applyLink(job)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.status === "Draft" ||
                  job.status === "Paused" ||
                  job.status === "Approved" ? (
                    <button
                      type="button"
                      onClick={() => beginEdit(job)}
                      className="rounded border px-3 py-1.5"
                    >
                      Edit
                    </button>
                  ) : null}
                  {job.status === "Draft" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(job.id, "Pending_Approval")}
                      className="rounded border px-3 py-1.5"
                    >
                      Submit for approval
                    </button>
                  ) : null}
                  {job.status === "Pending_Approval" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(job.id, "Approved")}
                      className="rounded border px-3 py-1.5"
                    >
                      Approve
                    </button>
                  ) : null}
                  {job.status === "Draft" ||
                  job.status === "Approved" ||
                  job.status === "Paused" ? (
                    <button
                      type="button"
                      onClick={() => void setStatus(job.id, "Published")}
                      className="rounded border border-[#0c918a] px-3 py-1.5 text-[#0f514e]"
                    >
                      Publish
                    </button>
                  ) : null}
                  {job.status === "Published" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void copyLink(job, "apply")}
                        className="rounded border px-3 py-1.5"
                      >
                        {copiedId === `${job.id}-apply` ? "Copied" : "Copy apply link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyLink(job, "public")}
                        className="rounded border px-3 py-1.5"
                      >
                        {copiedId === `${job.id}-public` ? "Copied" : "Copy job link"}
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
                  <button
                    type="button"
                    onClick={() => void duplicateJob(job.id)}
                    className="rounded border px-3 py-1.5"
                  >
                    Duplicate
                  </button>
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
