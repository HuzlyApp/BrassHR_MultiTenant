"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_SUBTITLE_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import type { JobRequisitionInput, PlacementType, SourceType } from "@/lib/jobs/types";
import {
  jobRequiresWorkflow,
  isMspRecruitAndEor,
  isMspRecruitAndRelease,
  resolvePlacementTypeForSource,
} from "@/lib/jobs/placement";
import { JobPostPreviewModal } from "./JobPostPreviewModal";
import { JobReviewEditModal, type ReviewEditFieldId } from "./JobReviewEditModal";
import { jobDescriptionPlainText } from "./JobDescriptionEditor";
import {
  JobFormFooter,
  JobFormStepCompensation,
  JobFormStepDescription,
  JobFormStepMspDetails,
  JobFormStepRequisition,
  JobFormStepReview,
  JobFormWorkflowBanner,
} from "./JobFormSteps";
import { JobFormStepSetup } from "./JobFormStepSetup";
import type { ExistingJobPickerOption } from "./ExistingJobPickerPanel";
import {
  applyUiToJob,
  defaultJobFormUiState,
  JOB_FORM_CENTER_COLUMN_CLASS,
  JOB_FORM_OUTLINE_BUTTON_CLASS,
  JOB_FORM_PAGE_CARD_CLASS,
  JOB_FORM_PRIMARY_BUTTON_CLASS,
  jobFormUiFromJob,
  jobRequisitionInputForNewFromReference,
  jobRequisitionInputFromApiRow,
  primaryButtonStyle,
  type JobFormOptionsPayload,
  type JobFormStep,
  type JobFormUiState,
} from "./job-form-shared";
import { ArrowRight } from "lucide-react";

const initialJob: JobRequisitionInput = {
  sourceType: "" as SourceType,
  placementType: null,
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

  const [step, setStep] = useState<JobFormStep>(jobId ? "requisition" : "setup");
  const [job, setJob] = useState<JobRequisitionInput>(initialJob);
  const [ui, setUi] = useState<JobFormUiState>(defaultJobFormUiState);
  const [options, setOptions] = useState<JobFormOptionsPayload | null>(null);
  const [mspSourcedByClient, setMspSourcedByClient] = useState<boolean | null>(null);
  const [mspPlacementType, setMspPlacementType] = useState<PlacementType | null>(null);
  const [referenceJobId, setReferenceJobId] = useState<string | null>(null);
  const [referenceJobOptions, setReferenceJobOptions] = useState<ExistingJobPickerOption[]>([]);
  const [referenceJobsLoading, setReferenceJobsLoading] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [workflow, setWorkflow] = useState<{
    workflowId?: string;
    workflowName: string;
    mappingCriteria?: string;
    source?: string;
  } | null>(null);
  const [workflowWarning, setWorkflowWarning] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"automatic" | "manual">("automatic");
  const [overrideWorkflowId, setOverrideWorkflowId] = useState<string | null>(null);
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
    if (jobId) return;
    setReferenceJobsLoading(true);
    void fetch("/api/admin/jobs", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
        setReferenceJobOptions((payload.jobs ?? []) as ExistingJobPickerOption[]);
      })
      .catch(() => setReferenceJobOptions([]))
      .finally(() => setReferenceJobsLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    void fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load job");
        const row = payload.job as Record<string, unknown>;
        setOriginalStatus(row.status === "published" ? "published" : "draft");
        const loadedJob = jobRequisitionInputFromApiRow(row);
        setJob(loadedJob);
        setUi(jobFormUiFromJob(loadedJob));
        const sourceRaw = String(row.source_type ?? "").trim().toLowerCase();
        setMspSourcedByClient(sourceRaw === "msp");
        if (sourceRaw === "msp") {
          setMspPlacementType(
            loadedJob.placementType === "Recruit_and_EOR"
              ? "Recruit_and_EOR"
              : "Recruit_and_Release"
          );
        }
        const mode = row.workflow_assignment_mode === "manual" ? "manual" : "automatic";
        setAssignmentMode(mode);
        if (mode === "manual" && row.workflow_id) {
          setOverrideWorkflowId(String(row.workflow_id));
          const flow = row.onboarding_flows as { name?: string } | { name?: string }[] | null;
          const flowName = Array.isArray(flow) ? flow[0]?.name : flow?.name;
          setWorkflow({
            workflowId: String(row.workflow_id),
            workflowName: flowName ? String(flowName) : "Manually assigned workflow",
            mappingCriteria: "Manual override",
            source: "manual",
          });
        }
        setStep(loadedJob.sourceType === "MSP" ? "msp-details" : "requisition");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to load job"));
  }, [jobId]);

  /** MSP R&R locks employment type to Contract; EOR W2/1099 must be chosen by the user. */
  useEffect(() => {
    if (job.sourceType !== "MSP") return;
    if (job.placementType === "Recruit_and_Release" && job.employmentType !== "Contract") {
      setJob((current) =>
        current.sourceType === "MSP" && current.placementType === "Recruit_and_Release"
          ? { ...current, employmentType: "Contract" }
          : current
      );
    }
  }, [job.sourceType, job.placementType, job.employmentType]);

  /** Keep create-job steps starting at the top after Next/Back. */
  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const wrap = document.querySelector(".admin-recruiter-main-wrap");
      if (wrap instanceof HTMLElement) wrap.scrollTop = 0;
    };
    scrollToTop();
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

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
    if (assignmentMode === "manual" && overrideWorkflowId) {
      const selected = options?.workflows?.find((item) => item.id === overrideWorkflowId);
      setWorkflow({
        workflowId: overrideWorkflowId,
        workflowName: selected?.name ?? "Manually assigned workflow",
        mappingCriteria: "Manual override",
        source: "manual",
      });
      setWorkflowWarning("");
      return;
    }

    /** MSP Recruit & Release jobs do not require an assigned onboarding workflow. */
    if (job.sourceType === "MSP" && !isMspRecruitAndEor(job)) {
      setWorkflow(null);
      setWorkflowWarning("");
      return;
    }

    if (!job.employmentType) {
      setWorkflow(null);
      setWorkflowWarning("");
      return;
    }
    const params = new URLSearchParams({
      employmentType: job.employmentType,
    });
    if (job.professionId) params.set("professionId", job.professionId);
    if (job.specialtyId) params.set("specialtyId", job.specialtyId);
    if (job.location) params.set("location", job.location);
    if (job.jobLocationType) params.set("locationType", job.jobLocationType);
    if (job.yearsOfExperience) params.set("yearsOfExperience", job.yearsOfExperience);

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/admin/jobs/workflow-preview?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json();
          if (response.ok && payload.match) {
            setWorkflow({
              workflowId: payload.match.workflowId,
              workflowName: payload.match.workflowName,
              mappingCriteria: payload.match.mappingCriteria,
              source: payload.match.source,
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
  }, [
    assignmentMode,
    overrideWorkflowId,
    job.sourceType,
    job.placementType,
    job.professionId,
    job.specialtyId,
    job.employmentType,
    job.location,
    job.jobLocationType,
    job.yearsOfExperience,
    options?.workflows,
  ]);

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

  function validateRequisitionStep(current: JobRequisitionInput): Record<string, string> {
    const errors: Record<string, string> = {};
    const isMsp = current.sourceType === "MSP";
    const isMspEor = isMsp && current.placementType === "Recruit_and_EOR";

    const location = current.location?.trim() || current.facility?.trim() || "";
    if (!location) {
      errors.location = "Location is required.";
    }

    if (!current.shiftType?.trim()) {
      errors.shiftType = "Employment Type is required.";
    }

    if (isMsp) {
      if (!current.sourceJobTitle?.trim()) {
        errors.sourceJobTitle = "Source Job Title is required.";
      }
      if (!current.mspClient?.trim()) {
        errors.mspClient = "MSP Name is required.";
      }
      if (!current.mspName?.trim()) {
        errors.mspName = "Contract Group / Client is required.";
      }
      if (!current.externalRequisitionId?.trim()) {
        errors.externalRequisitionId = "Internal Reference / Source Job ID is required.";
      }
      if (isMspEor) {
        if (!current.professionId) {
          errors.professionId = "Profession is required.";
        }
        if (current.employmentType !== "W2" && current.employmentType !== "1099") {
          errors.employmentType = "Select W2 or 1099 for EOR placements.";
        }
      }
    } else {
      if (!current.publicTitle?.trim()) {
        errors.publicTitle = "Job Title is required.";
      }
      if (!current.professionId) {
        errors.professionId = "Profession is required.";
      }
      if (!current.employmentType) {
        errors.employmentType = "Employment Type is required.";
      }
    }

    return errors;
  }

  function validateDescriptionStep(current: JobRequisitionInput): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!jobDescriptionPlainText(current.publicDescription ?? "").trim()) {
      errors.publicDescription = "Job description is required.";
    }
    return errors;
  }

  async function save(action: "save_draft" | "publish", forceRoutingChange = false) {
    setSaving(true);
    setMessage("");
    setFieldErrors({});
    const payloadJob = buildPayloadJob();

    if (action === "publish") {
      const stepErrors = {
        ...validateRequisitionStep(payloadJob),
        ...validateDescriptionStep(payloadJob),
      };
      if (Object.keys(stepErrors).length > 0) {
        setFieldErrors(stepErrors);
        setSaving(false);
        if (stepErrors.publicDescription) {
          setStep("description");
        } else if (
          stepErrors.location ||
          stepErrors.shiftType ||
          stepErrors.sourceJobTitle ||
          stepErrors.mspClient ||
          stepErrors.mspName ||
          stepErrors.externalRequisitionId ||
          stepErrors.publicTitle ||
          stepErrors.professionId ||
          stepErrors.employmentType
        ) {
          setStep(payloadJob.sourceType === "MSP" ? "msp-details" : "requisition");
        }
        setMessage("Please complete the required fields before publishing.");
        return;
      }
    }

    try {
      const response = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          job: payloadJob,
          jobId,
          confirmRoutingChange: forceRoutingChange || confirmRoutingChange,
          resetToAutomatic: assignmentMode === "automatic",
          overrideWorkflowId: assignmentMode === "manual" ? overrideWorkflowId : undefined,
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
    if (step === "setup") {
      router.push("/admin_recruiter/jobs");
      return;
    }
    if (step === "msp-details") {
      setStep(jobId ? "requisition" : "setup");
      return;
    }
    if (step === "requisition") {
      if (!jobId) {
        setStep("setup");
        return;
      }
      router.push("/admin_recruiter/jobs");
      return;
    }
    if (step === "compensation") {
      setStep(job.sourceType === "MSP" ? "msp-details" : "requisition");
      return;
    }
    if (step === "description") {
      setStep("compensation");
      return;
    }
    if (step === "review") {
      setStep("description");
      return;
    }
    router.push("/admin_recruiter/jobs");
  }

  async function handleSetupContinue() {
    if (mspSourcedByClient == null) {
      setFieldErrors({ mspSourcedByClient: "Please select Yes or No." });
      return;
    }
    if (mspSourcedByClient && !mspPlacementType) {
      setFieldErrors({ mspPlacementType: "Select Recruit & Release or Recruit & EOR." });
      return;
    }
    setFieldErrors({});
    setSetupBusy(true);
    setMessage("");

    const nextSourceType: SourceType = mspSourcedByClient ? "MSP" : "Internal";
    const nextPlacementType = resolvePlacementTypeForSource(
      nextSourceType,
      mspPlacementType
    );

    try {
      if (referenceJobId) {
        const response = await fetch(`/api/admin/jobs/${encodeURIComponent(referenceJobId)}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load reference job");
        const loaded = jobRequisitionInputFromApiRow(payload.job as Record<string, unknown>);
        const nextJob = jobRequisitionInputForNewFromReference(
          loaded,
          nextSourceType,
          mspPlacementType
        );
        setJob(nextJob);
        setUi(jobFormUiFromJob(nextJob));
      } else {
        setJob((current) => ({
          ...initialJob,
          sourceType: nextSourceType,
          placementType: nextPlacementType,
          publicTitle: current.publicTitle,
          employmentType: mspSourcedByClient
            ? nextPlacementType === "Recruit_and_EOR"
              ? ("" as JobRequisitionInput["employmentType"])
              : ("Contract" as JobRequisitionInput["employmentType"])
            : ("" as JobRequisitionInput["employmentType"]),
        }));
        setUi(defaultJobFormUiState());
      }

      setStep(mspSourcedByClient ? "msp-details" : "requisition");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load reference job");
    } finally {
      setSetupBusy(false);
    }
  }

  function handleNext() {
    if (step === "requisition") {
      const errors = validateRequisitionStep(job);
      if (Object.keys(errors).length > 0) {
        setFieldErrors((current) => ({ ...current, ...errors }));
        return;
      }
      setStep(job.sourceType === "MSP" ? "msp-details" : "compensation");
      return;
    }
    if (step === "msp-details") {
      const errors = validateRequisitionStep(buildPayloadJob());
      if (Object.keys(errors).length > 0) {
        setFieldErrors((current) => ({ ...current, ...errors }));
        return;
      }
      setStep("compensation");
      return;
    }
    if (step === "compensation") {
      setStep("description");
      return;
    }
    if (step === "description") {
      const errors = validateDescriptionStep(job);
      if (Object.keys(errors).length > 0) {
        setFieldErrors((current) => ({ ...current, ...errors }));
        return;
      }
      setStep("review");
    }
  }

  const pageTitle =
    step === "setup"
      ? "Create Job Requisition"
      : step === "review"
        ? "Review"
        : step === "description"
          ? "Describe the job"
          : step === "compensation"
            ? isMspRecruitAndRelease(job)
              ? "Commission Fees"
              : job.sourceType === "MSP"
                ? "Rates & Contract"
                : "Compensation"
            : jobId
              ? "Edit job post"
              : "Create a job post";
  const pageSubtitle =
    step === "setup"
      ? ""
      : step === "review"
        ? ""
        : step === "description"
          ? "Add job description"
          : step === "compensation"
            ? isMspRecruitAndRelease(job)
              ? "Set the tenant commission fee for this Recruit & Release placement."
              : "Review the pay we estimated for your job and adjust as needed. Check your local minimum wage."
            : step === "msp-details"
              ? "Job Source Details"
              : "Job Requisition";
  const showPublishActions = step === "review";
  const requiresWorkflow = jobRequiresWorkflow(buildPayloadJob());

  return (
    <main className="w-full px-2 py-3 min-[700px]:px-4 min-[700px]:py-4 lg:px-5">
      <div className={JOB_FORM_PAGE_CARD_CLASS} style={brandVars}>
        <div className={JOB_FORM_CENTER_COLUMN_CLASS}>
          <div className="mb-5 flex items-start justify-between gap-3 min-[700px]:mb-6 min-[700px]:gap-4">
            <div className="min-w-0 flex-1">
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
              className={`mt-1 inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap text-sm font-medium no-underline transition hover:opacity-80 min-[700px]:mt-0 ${
                step === "setup" ? "hidden" : ""
              }`}
              style={{ color: branding.secondaryHex || "#012352" }}
            >
              <BrandedSvgIcon
                src="/eva_arrow-back-fill.svg"
                className="h-[14px] w-[14px]"
                color={branding.secondaryHex || "#012352"}
              />
              Back to jobs
            </Link>
          </div>

          {message ? (
            <div className="mb-5 whitespace-pre-line rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <div
            className={
              step === "requisition" || step === "setup"
                ? "flex min-h-0 flex-1 flex-col gap-5"
                : "flex-1 space-y-5"
            }
          >
            {step === "setup" ? (
              <JobFormStepSetup
                mspSourcedByClient={mspSourcedByClient}
                onMspSourcedByClientChange={(value) => {
                  setMspSourcedByClient(value);
                  if (!value) setMspPlacementType(null);
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.mspSourcedByClient;
                    delete next.mspPlacementType;
                    return next;
                  });
                  setReferenceJobId((current) => {
                    if (!current) return null;
                    const selected = referenceJobOptions.find((row) => row.id === current);
                    if (!selected) return null;
                    const isMsp =
                      String(selected.source_type ?? "").trim().toLowerCase() === "msp";
                    return value === isMsp ? current : null;
                  });
                }}
                mspPlacementType={mspPlacementType}
                onMspPlacementTypeChange={(value) => {
                  setMspPlacementType(value);
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.mspPlacementType;
                    return next;
                  });
                }}
                jobs={referenceJobOptions}
                jobsLoading={referenceJobsLoading}
                selectedReferenceJobId={referenceJobId}
                onSelectReferenceJob={setReferenceJobId}
                fieldErrors={fieldErrors}
              />
            ) : null}

            {step === "requisition" ? (
              <>
                <JobFormStepRequisition
                  job={job}
                  ui={ui}
                  fieldErrors={fieldErrors}
                  professions={options?.professions ?? []}
                  specialties={specialties}
                  employmentTypes={options?.employmentTypes ?? ["W2", "1099"]}
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
                  assignmentMode={assignmentMode}
                  publishedWorkflows={options?.workflows ?? []}
                  overrideWorkflowId={overrideWorkflowId}
                  onOverrideWorkflow={(workflowId) => {
                    setAssignmentMode("manual");
                    setOverrideWorkflowId(workflowId);
                  }}
                  onResetToAutomatic={() => {
                    setAssignmentMode("automatic");
                    setOverrideWorkflowId(null);
                  }}
                />
              </>
            ) : null}

            {step === "msp-details" ? (
              <>
                <JobFormStepMspDetails
                  job={job}
                  ui={ui}
                  fieldErrors={fieldErrors}
                  professions={options?.professions ?? []}
                  specialties={specialties}
                  onJobChange={updateJob}
                  onUiChange={updateUi}
                />
                {isMspRecruitAndEor(job) ? (
                  <JobFormWorkflowBanner
                    workflowName={workflow?.workflowName}
                    workflowWarning={workflowWarning}
                    mappingCriteria={workflow?.mappingCriteria}
                    mappingLink={mappingLink}
                    canManageWorkflows={Boolean(options?.canManageWorkflows)}
                    fieldError={fieldErrors.workflowId}
                    assignmentMode={assignmentMode}
                    publishedWorkflows={options?.workflows ?? []}
                    overrideWorkflowId={overrideWorkflowId}
                    onOverrideWorkflow={(workflowId) => {
                      setAssignmentMode("manual");
                      setOverrideWorkflowId(workflowId);
                    }}
                    onResetToAutomatic={() => {
                      setAssignmentMode("automatic");
                      setOverrideWorkflowId(null);
                    }}
                  />
                ) : null}
              </>
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

            {step === "description" ? (
              <JobFormStepDescription
                job={job}
                ui={ui}
                fieldErrors={fieldErrors}
                onJobChange={updateJob}
                professionName={professionLabel}
                specialtyName={specialtyLabel}
                companyName={branding.companyName}
                brandStyle={brandStyle}
              />
            ) : null}

            {step === "review" ? (
              <JobFormStepReview
                job={buildPayloadJob()}
                ui={ui}
                professionName={professionLabel}
                specialtyName={specialtyLabel}
                onEditField={setReviewEditField}
                brandVars={brandVars}
              />
            ) : null}
          </div>

          {step === "setup" ? (
            <div className="mt-8 flex flex-col-reverse gap-2 border-t border-[#E5E7EB] pt-5 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between">
              <Link
                href="/admin_recruiter/jobs"
                className={`${JOB_FORM_OUTLINE_BUTTON_CLASS} w-full min-[700px]:w-auto text-center no-underline`}
              >
                Cancel
              </Link>
              <button
                type="button"
                className={`${JOB_FORM_PRIMARY_BUTTON_CLASS} w-full min-[700px]:w-auto`}
                style={brandStyle}
                disabled={setupBusy}
                onClick={() => void handleSetupContinue()}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <JobFormFooter
              step={step}
              saving={saving}
              canPublish={!requiresWorkflow || Boolean(workflow)}
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
          )}

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
