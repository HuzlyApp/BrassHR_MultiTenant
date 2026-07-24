"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import type { JobRequisitionInput, SourceType } from "@/lib/jobs/types";
import { JobPostPreviewModal } from "./JobPostPreviewModal";
import { JobReviewEditModal, type ReviewEditFieldId } from "./JobReviewEditModal";
import {
  JobFormFooter,
  JobFormStepCompensation,
  JobFormStepMspDetails,
  JobFormStepRequisition,
  JobFormStepReview,
  JobFormWorkflowBanner,
} from "./JobFormSteps";
import {
  applyUiToJob,
  defaultJobFormUiState,
  JOB_FORM_CENTER_COLUMN_CLASS,
  JOB_FORM_PAGE_CARD_CLASS,
  jobFormUiFromJob,
  primaryButtonStyle,
  type JobFormOptionsPayload,
  type JobFormStep,
  type JobFormUiState,
} from "./job-form-shared";

const initialJob: JobRequisitionInput = {
  sourceType: "" as SourceType,
  professionId: "",
  specialtyId: null,
  employmentType: "" as JobRequisitionInput["employmentType"],
  internalRequisitionNumber: "",
  publicTitle: "",
  publicDescription: "",
  location: "",
  employerOfRecord: null,
};

export default function JobRequisitionForm({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const branding = useTenantBranding();
  const brandVars = brandingToCssVars(branding) as CSSProperties;
  const brandStyle = primaryButtonStyle(brandVars);

  const [step, setStep] = useState<JobFormStep>("requisition");
  const [job, setJob] = useState<JobRequisitionInput>(initialJob);
  const [ui, setUi] = useState<JobFormUiState>(defaultJobFormUiState);
  const [options, setOptions] = useState<JobFormOptionsPayload | null>(null);
  const [workflow, setWorkflow] = useState<{ workflowName: string; mappingCriteria?: string } | null>(
    null
  );
  const [workflowWarning, setWorkflowWarning] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewEditField, setReviewEditField] = useState<ReviewEditFieldId | null>(null);
  const [originalStatus, setOriginalStatus] = useState<"draft" | "published">("draft");
  const [confirmRoutingChange, setConfirmRoutingChange] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

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
        const additionalRaw = row.additional_locations;
        const additionalLocations = Array.isArray(additionalRaw)
          ? additionalRaw.map((item) => String(item ?? "").trim()).filter(Boolean)
          : [];
        const loadedJob: JobRequisitionInput = {
          internalRequisitionNumber: String(row.internal_requisition_number ?? ""),
          externalRequisitionId: String(row.external_requisition_id ?? ""),
          sourceType: row.source_type as JobRequisitionInput["sourceType"],
          mspClient: String(row.msp_client ?? ""),
          professionId: String(row.profession_id ?? ""),
          specialtyId: row.specialty_id ? String(row.specialty_id) : null,
          employmentType: row.employment_type as JobRequisitionInput["employmentType"],
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
          numberOfPositions:
            row.positions_count == null ? 1 : Math.max(1, Number(row.positions_count) || 1),
          yearsOfExperience: row.years_of_experience
            ? String(row.years_of_experience)
            : row.years_experience_required != null
              ? `${row.years_experience_required} yrs`
              : null,
          additionalLocations,
          showInMultipleAreas: Boolean(row.show_in_multiple_areas),
          jobLocationType: row.location_type
            ? String(row.location_type)
            : row.schedule
              ? String(row.schedule)
              : null,
          isEmployerOnRecord:
            typeof row.is_employer_on_record === "boolean" ? row.is_employer_on_record : true,
          compensationType: row.compensation_type ? String(row.compensation_type) : null,
          currency: row.currency ? String(row.currency) : null,
          showPayBy: row.show_pay_by ? String(row.show_pay_by) : null,
          payRatePeriod: row.pay_rate_period
            ? String(row.pay_rate_period)
            : row.rate_unit
              ? String(row.rate_unit)
              : null,
          mspName: row.msp_name ? String(row.msp_name) : null,
          sourceJobTitle: row.source_job_title ? String(row.source_job_title) : null,
          sourceJobUrl: row.source_job_url ? String(row.source_job_url) : null,
          sourceJobDetails: row.source_job_details ? String(row.source_job_details) : null,
          suggestedPayRate: row.pay_rate == null ? null : Number(row.pay_rate),
          requiredCredentials: Array.isArray(row.required_credentials)
            ? row.required_credentials
                .map((item) => String(item ?? "").trim())
                .filter(Boolean)
                .join(", ")
            : row.required_credentials
              ? String(row.required_credentials)
              : null,
          specialRequirements: row.special_requirements
            ? String(row.special_requirements)
            : null,
          internalNotes: row.internal_notes ? String(row.internal_notes) : null,
        };
        setJob(loadedJob);
        setUi(jobFormUiFromJob(loadedJob));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load job"));
  }, [jobId]);

  const professionLabel = useMemo(
    () => options?.professions.find((item) => item.id === job.professionId)?.name ?? "",
    [job.professionId, options?.professions]
  );

  const specialtyLabel = useMemo(
    () => options?.specialties.find((item) => item.id === job.specialtyId)?.name ?? "",
    [job.specialtyId, options?.specialties]
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

  function updateJob<K extends keyof JobRequisitionInput>(key: K, value: JobRequisitionInput[K]) {
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

  function updateUi(patch: Partial<JobFormUiState>) {
    setUi((current) => ({ ...current, ...patch }));
  }

  function buildPayloadJob(): JobRequisitionInput {
    return applyUiToJob(job, ui);
  }

  async function save(action: "save_draft" | "publish", forceRoutingChange = false) {
    setSaving(true);
    setMessage("");
    setFieldErrors({});
    const payloadJob = buildPayloadJob();
    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          job: payloadJob,
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

  function handleBack() {
    if (step === "msp-details") {
      setStep("requisition");
      return;
    }
    if (step === "compensation") {
      setStep(job.sourceType === "MSP" ? "msp-details" : "requisition");
      return;
    }
    if (step === "review") {
      setStep("compensation");
      return;
    }
    router.push("/admin_recruiter/jobs");
  }

  function handleNext() {
    if (step === "requisition") {
      setStep(job.sourceType === "MSP" ? "msp-details" : "compensation");
      return;
    }
    if (step === "msp-details") {
      setStep("compensation");
      return;
    }
    if (step === "compensation") setStep("review");
  }

  const pageTitle =
    step === "review" ? "Review" : jobId ? "Edit job post" : "Create a job post";
  const pageSubtitle =
    step === "review"
      ? ""
      : step === "compensation"
        ? job.sourceType === "MSP"
          ? "Benefits & Description"
          : "Compensation & Description"
        : step === "msp-details"
          ? "Job Source Details"
          : "Job Requisition";
  const showPublishActions = step === "review";

  return (
    <main className="w-full px-3 py-4 sm:px-4 lg:px-5">
      <div className={JOB_FORM_PAGE_CARD_CLASS}>
        <div className={JOB_FORM_CENTER_COLUMN_CLASS}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
                {pageTitle}
              </h1>
              {pageSubtitle ? (
                <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                  {pageSubtitle}
                </p>
              ) : null}
            </div>
            <Link
              href="/admin_recruiter/jobs"
              className="shrink-0 text-sm font-medium text-[#64748B] transition hover:text-[#334155]"
            >
              Back to jobs
            </Link>
          </div>

          {message ? (
            <div className="mb-5 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <div className="flex-1 space-y-5">
            {step === "requisition" ? (
              <>
                <JobFormStepRequisition
                  job={job}
                  ui={ui}
                  fieldErrors={fieldErrors}
                  professions={options?.professions ?? []}
                  specialties={specialties}
                  employmentTypes={options?.employmentTypes ?? ["W2", "1099", "Contract"]}
                  sourceTypes={options?.sourceTypes ?? ["Internal", "MSP"]}
                  employerOfRecordOptions={options?.employerOfRecordOptions ?? []}
                  onJobChange={updateJob}
                  onUiChange={updateUi}
                />
                <JobFormWorkflowBanner
                  workflowName={workflow?.workflowName}
                  workflowWarning={workflowWarning}
                  mappingCriteria={workflow?.mappingCriteria}
                  mappingLink={mappingLink}
                  canManageWorkflows={Boolean(options?.canManageWorkflows)}
                  fieldError={fieldErrors.workflowId}
                />
              </>
            ) : null}

            {step === "msp-details" ? (
              <JobFormStepMspDetails
                job={job}
                ui={ui}
                fieldErrors={fieldErrors}
                onJobChange={updateJob}
                onUiChange={updateUi}
              />
            ) : null}

            {step === "compensation" ? (
              <JobFormStepCompensation
                job={job}
                ui={ui}
                fieldErrors={fieldErrors}
                onJobChange={updateJob}
                onUiChange={updateUi}
              />
            ) : null}

            {step === "review" ? (
              <JobFormStepReview
                job={buildPayloadJob()}
                ui={ui}
                professionName={professionLabel}
                specialtyName={specialtyLabel}
                onEditField={setReviewEditField}
              />
            ) : null}
          </div>

          <JobFormFooter
            step={step}
            saving={saving}
            canPublish={Boolean(workflow)}
            showPublishActions={showPublishActions && originalStatus !== "published"}
            termsAccepted={termsAccepted}
            brandStyle={brandStyle}
            onBack={handleBack}
            onNext={handleNext}
            onPreview={() => setPreviewOpen(true)}
            onSaveDraft={() => void save(originalStatus === "published" ? "publish" : "save_draft")}
            onPublish={() => void save("publish")}
            onTermsChange={setTermsAccepted}
          />

          {originalStatus === "published" && step === "review" ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("publish")}
                className="cursor-pointer text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
              >
                Update published job
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <JobReviewEditModal
        open={reviewEditField != null}
        field={reviewEditField}
        job={job}
        ui={ui}
        brandStyle={brandStyle}
        brandVars={brandVars}
        professions={options?.professions ?? []}
        specialties={options?.specialties ?? []}
        employmentTypes={options?.employmentTypes ?? ["W2", "1099", "Contract"]}
        sourceTypes={options?.sourceTypes ?? ["Internal", "MSP"]}
        employerOfRecordOptions={options?.employerOfRecordOptions ?? []}
        onOpenChange={(open) => {
          if (!open) setReviewEditField(null);
        }}
        onUpdate={({ job: nextJob, ui: nextUi }) => {
          setJob(nextJob);
          setUi(nextUi);
          setReviewEditField(null);
        }}
      />

      <JobPostPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        job={buildPayloadJob()}
        ui={ui}
        companyName={branding.companyName}
        brandStyle={brandStyle}
        brandVars={brandVars}
      />
    </main>
  );
}
