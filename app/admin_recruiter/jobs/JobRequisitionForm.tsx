"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  EmploymentType,
  JobRequisitionInput,
  SourceType,
} from "@/lib/jobs/types";

type Option = { id: string; name: string };
type SpecialtyOption = Option & { profession_id: string };
type OptionsPayload = {
  professions: Option[];
  specialties: SpecialtyOption[];
  employmentTypes: EmploymentType[];
  sourceTypes: SourceType[];
  canManageWorkflows: boolean;
};

const initialJob: JobRequisitionInput = {
  sourceType: "Internal",
  professionId: "",
  specialtyId: null,
  employmentType: "W2",
  publicTitle: "",
  publicDescription: "",
  location: "",
};

function Field({
  label,
  publicField = false,
  error,
  children,
}: {
  label: string;
  publicField?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
        {label}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            publicField ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {publicField ? "Public" : "Internal"}
        </span>
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function JobRequisitionForm({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRequisitionInput>(initialJob);
  const [options, setOptions] = useState<OptionsPayload | null>(null);
  const [workflow, setWorkflow] = useState<{
    workflowName: string;
    mappingCriteria?: string;
  } | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<"draft" | "published">("draft");
  const [confirmRoutingChange, setConfirmRoutingChange] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/job-options", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load options");
        setOptions(payload);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load options"));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    void fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load job");
        const row = payload.job as Record<string, unknown>;
        setOriginalStatus(row.status === "published" ? "published" : "draft");
        setJob({
          internalRequisitionNumber: String(row.internal_requisition_number ?? ""),
          externalRequisitionId: String(row.external_requisition_id ?? ""),
          sourceType: row.source_type as SourceType,
          mspClient: String(row.msp_client ?? ""),
          professionId: String(row.profession_id ?? ""),
          specialtyId: row.specialty_id ? String(row.specialty_id) : null,
          employmentType: row.employment_type as EmploymentType,
          employerOfRecord: String(row.employer_of_record ?? ""),
          department: String(row.department ?? ""),
          facility: String(row.facility ?? ""),
          billRate: row.bill_rate == null ? null : Number(row.bill_rate),
          payRateMin: row.pay_rate_min == null ? null : Number(row.pay_rate_min),
          payRateMax: row.pay_rate_max == null ? null : Number(row.pay_rate_max),
          targetStartDate: row.target_start_date ? String(row.target_start_date) : null,
          duration: String(row.duration ?? ""),
          shiftType: String(row.shift_type ?? ""),
          shiftDetails: String(row.shift_details ?? ""),
          hoursPerWeek: row.hours_per_week == null ? null : Number(row.hours_per_week),
          publicTitle: String(row.public_title ?? ""),
          publicDescription: String(row.public_description ?? ""),
          location: String(row.location ?? ""),
          schedule: String(row.schedule ?? ""),
          qualifications: String(row.qualifications ?? ""),
          responsibilities: String(row.responsibilities ?? ""),
          benefits: String(row.benefits ?? ""),
          applicationDeadline: row.application_deadline ? String(row.application_deadline) : null,
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load job"));
  }, [jobId]);

  const professionLabel = useMemo(
    () => options?.professions.find((item) => item.id === job.professionId)?.name ?? "",
    [job.professionId, options?.professions]
  );

  const mappingLink = useMemo(() => {
    const params = new URLSearchParams();
    if (job.professionId) params.set("professionId", job.professionId);
    if (job.employmentType) params.set("employmentType", job.employmentType);
    return `/admin_recruiter/dashboard/workflow-mappings?${params}`;
  }, [job.employmentType, job.professionId]);

  useEffect(() => {
    if (!job.professionId || !job.employmentType) {
      setWorkflow(null);
      setWorkflowWarning("");
      return;
    }
    const params = new URLSearchParams({
      professionId: job.professionId,
      employmentType: job.employmentType,
    });
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/admin/jobs/workflow-preview?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json();
          if (response.ok && payload.match) {
            const criteria = professionLabel
              ? `${professionLabel} + ${job.employmentType}`
              : undefined;
            setWorkflow({
              workflowName: payload.match.workflowName,
              mappingCriteria: criteria,
            });
            setWorkflowWarning("");
          } else {
            setWorkflow(null);
            setWorkflowWarning(payload.warning || payload.error || "No workflow is configured.");
          }
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setWorkflow(null);
          setWorkflowWarning("Workflow assignment could not be checked.");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [job.professionId, job.employmentType, professionLabel]);

  const specialties = useMemo(
    () => options?.specialties.filter((item) => item.profession_id === job.professionId) ?? [],
    [job.professionId, options?.specialties]
  );

  function update<K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) {
    if (
      originalStatus === "published" &&
      (key === "professionId" || key === "employmentType")
    ) {
      setConfirmRoutingChange(false);
    }
    setJob((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function save(action: "save_draft" | "publish", forceRoutingChange = false) {
    setSaving(true);
    setMessage("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          job,
          jobId,
          confirmRoutingChange: forceRoutingChange || confirmRoutingChange,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.code === "ROUTING_CHANGE_CONFIRMATION_REQUIRED") {
          const confirmed = window.confirm(
            `${payload.error}\n\nExisting applicants will keep their current workflow. Continue?`
          );
          if (confirmed) {
            setConfirmRoutingChange(true);
            await save(action, true);
            return;
          }
        }
        setFieldErrors(payload.fieldErrors ?? {});
        throw new Error(payload.error || "Failed to save job");
      }
      router.push("/admin_recruiter/jobs");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Job requisitions</p>
          <h1 className="text-2xl font-semibold text-slate-900">{jobId ? "Edit job requisition" : "Create job requisition"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Drafts may be incomplete. Publishing validates public details and workflow assignment.
          </p>
        </div>
        <Link href="/admin_recruiter/jobs" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Back to jobs
        </Link>
      </div>

      {message ? (
        <div className="mb-5 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Internal job configuration</h2>
            <p className="text-sm text-slate-500">These fields are never shown on the public job page.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Internal requisition number">
              <input className={inputClass} value={job.internalRequisitionNumber ?? ""} onChange={(e) => update("internalRequisitionNumber", e.target.value)} />
            </Field>
            <Field label="External requisition ID" error={fieldErrors.externalRequisitionId}>
              <input className={inputClass} value={job.externalRequisitionId ?? ""} onChange={(e) => update("externalRequisitionId", e.target.value)} />
            </Field>
            <Field label="Source type" error={fieldErrors.sourceType}>
              <select className={inputClass} value={job.sourceType} onChange={(e) => update("sourceType", e.target.value as SourceType)}>
                {options?.sourceTypes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            {job.sourceType === "MSP" ? (
              <Field label="MSP client" error={fieldErrors.mspClient}>
                <input className={inputClass} value={job.mspClient ?? ""} onChange={(e) => update("mspClient", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Profession" error={fieldErrors.professionId}>
              <select
                className={inputClass}
                value={job.professionId}
                onChange={(e) => {
                  update("professionId", e.target.value);
                  update("specialtyId", null);
                }}
              >
                <option value="">Select profession</option>
                {options?.professions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Specialty" error={fieldErrors.specialtyId}>
              <select className={inputClass} value={job.specialtyId ?? ""} disabled={!job.professionId} onChange={(e) => update("specialtyId", e.target.value || null)}>
                <option value="">Select specialty</option>
                {specialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Employment type" error={fieldErrors.employmentType}>
              <select className={inputClass} value={job.employmentType} onChange={(e) => update("employmentType", e.target.value as EmploymentType)}>
                {options?.employmentTypes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Employer of Record" error={fieldErrors.employerOfRecord}>
              <input className={inputClass} value={job.employerOfRecord ?? ""} onChange={(e) => update("employerOfRecord", e.target.value)} />
            </Field>
            <Field label="Department">
              <input className={inputClass} value={job.department ?? ""} onChange={(e) => update("department", e.target.value)} />
            </Field>
            <Field label="Facility">
              <input className={inputClass} value={job.facility ?? ""} onChange={(e) => update("facility", e.target.value)} />
            </Field>
            <Field label="Shift type">
              <select className={inputClass} value={job.shiftType ?? ""} onChange={(e) => update("shiftType", e.target.value || null)}>
                <option value="">Select shift</option>
                <option>Day</option><option>Evening</option><option>Night</option><option>Rotating</option><option>PRN</option>
              </select>
            </Field>
            <Field label="Bill rate">
              <input className={inputClass} type="number" min="0" step="0.01" value={job.billRate ?? ""} onChange={(e) => update("billRate", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Target start date">
              <input className={inputClass} type="date" value={job.targetStartDate ?? ""} onChange={(e) => update("targetStartDate", e.target.value || null)} />
            </Field>
            <Field label="Duration">
              <input className={inputClass} placeholder="e.g. 13 weeks" value={job.duration ?? ""} onChange={(e) => update("duration", e.target.value)} />
            </Field>
            <Field label="Hours per week">
              <input className={inputClass} type="number" min="0" step="0.5" value={job.hoursPerWeek ?? ""} onChange={(e) => update("hoursPerWeek", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>

          <div className={`mt-5 rounded-lg border p-4 ${workflow ? "border-teal-200 bg-teal-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-semibold text-slate-800">Assigned workflow</p>
            {workflow ? (
              <>
                <p className="mt-1 text-sm font-medium text-teal-900">{workflow.workflowName}</p>
                {workflow.mappingCriteria ? (
                  <p className="mt-1 text-xs text-teal-800">
                    Automatically selected from: {workflow.mappingCriteria}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 whitespace-pre-line text-sm text-amber-800">
                {workflowWarning || "Select profession, employment type, and placement type to resolve a workflow."}
              </p>
            )}
            {fieldErrors.workflowId ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.workflowId}</p> : null}
            {options?.canManageWorkflows ? (
              <Link href={mappingLink} className="mt-2 inline-block text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
                {workflow ? "Manage workflow mappings" : "Create workflow mapping"}
              </Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Public job information</h2>
            <p className="text-sm text-slate-500">Only approved public fields appear on the tenant job portal.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Public job title" publicField error={fieldErrors.publicTitle}>
              <input className={inputClass} value={job.publicTitle ?? ""} onChange={(e) => update("publicTitle", e.target.value)} />
            </Field>
            <Field label="Location" publicField error={fieldErrors.location}>
              <input className={inputClass} value={job.location ?? ""} onChange={(e) => update("location", e.target.value)} />
            </Field>
            <Field label="Schedule" publicField>
              <input className={inputClass} value={job.schedule ?? ""} onChange={(e) => update("schedule", e.target.value)} />
            </Field>
            <Field label="Application deadline" publicField>
              <input className={inputClass} type="date" value={job.applicationDeadline ?? ""} onChange={(e) => update("applicationDeadline", e.target.value || null)} />
            </Field>
            <Field label="Minimum pay rate" publicField>
              <input className={inputClass} type="number" min="0" step="0.01" value={job.payRateMin ?? ""} onChange={(e) => update("payRateMin", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Maximum pay rate" publicField error={fieldErrors.payRateMax}>
              <input className={inputClass} type="number" min="0" step="0.01" value={job.payRateMax ?? ""} onChange={(e) => update("payRateMax", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Public job description" publicField error={fieldErrors.publicDescription}>
                <textarea className={`${inputClass} min-h-36`} value={job.publicDescription ?? ""} onChange={(e) => update("publicDescription", e.target.value)} />
              </Field>
            </div>
            {(["qualifications", "responsibilities", "benefits"] as const).map((key) => (
              <div key={key} className={key === "benefits" ? "md:col-span-2" : ""}>
                <Field label={key[0].toUpperCase() + key.slice(1)} publicField>
                  <textarea className={`${inputClass} min-h-24`} value={job[key] ?? ""} onChange={(e) => update(key, e.target.value)} />
                </Field>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <button type="button" disabled={saving} onClick={() => void save(originalStatus === "published" ? "publish" : "save_draft")} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {jobId ? "Update" : "Save Draft"}
        </button>
        {originalStatus !== "published" ? (
          <button type="button" disabled={saving || !workflow} onClick={() => void save("publish")} className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            {jobId ? "Publish" : "Save and Publish"}
          </button>
        ) : null}
      </div>
    </main>
  );
}
