"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Eye,
  FileSignature,
  FileText,
  Layers,
  ShieldCheck,
  UploadCloud,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, readableTextOnBrand } from "@/lib/tenant/tenant-branding";
import type {
  WorkflowStepInspection,
  WorkflowStepInspectionKind,
} from "@/lib/onboarding/candidate-workflow-step-inspection";
import {
  stepDisplayStatusLabel,
  type WorkflowStepDisplayStatus,
} from "@/lib/onboarding/assigned-workflow-steps";
import {
  decisionLabel,
  isDecisionVariant,
  staffActionLabel,
  staffActionResultMessage,
  staffStepVariantForLibraryId,
  type StaffStepAction,
  type StaffStepEmailResult,
} from "@/lib/onboarding/staff-step-review-shared";
import { lifecyclePhaseLabel } from "@/lib/onboarding/workflow-phase-groups";
import {
  candidateInterviewStatusLabel,
  candidateInterviewStatusTone,
  interviewStepStatus,
  STEP_PILL_TONE_CLASSES,
  type CandidateInterview,
} from "@/lib/onboarding/interview-step";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
import SkillAssessmentResults from "./SkillAssessmentResults";
import WorkflowStepStaffActionModal from "./WorkflowStepStaffActionModal";

const KIND_ICONS: Record<WorkflowStepInspectionKind, LucideIcon> = {
  resume: FileText,
  upload: UploadCloud,
  form: ClipboardList,
  assessment: ClipboardCheck,
  references: Users,
  agreement: FileSignature,
  background_check: ShieldCheck,
  final_review: CheckCircle2,
  generic: Layers,
};

/** Status colour stays semantic so it never competes with the tenant palette. */
const STATUS_TONE: Record<WorkflowStepDisplayStatus, string> = {
  not_started: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  submitted: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  under_review: "bg-amber-50 text-amber-800 ring-amber-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  needs_revision: "bg-orange-50 text-orange-800 ring-orange-200",
  skipped: "bg-slate-100 text-slate-600 ring-slate-200",
  not_applicable: "bg-slate-100 text-slate-600 ring-slate-200",
  blocked: "bg-red-50 text-red-700 ring-red-200",
};

/** Decision steps are a staff to-do, so their open states read amber/orange rather than grey/blue. */
const DECISION_TONE: Partial<Record<WorkflowStepDisplayStatus, WorkflowStepDisplayStatus>> = {
  not_started: "under_review",
  in_progress: "needs_revision",
  blocked: "rejected",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAnswer(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function titleCase(value: string): string {
  return value
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{value?.trim() || "—"}</dd>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {count != null ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  online: "Online",
  phone: "Phone",
  in_person: "In person",
};

function InterviewCard({
  interview,
  total,
  latest,
}: {
  interview: CandidateInterview;
  total: number;
  latest: boolean;
}) {
  const name =
    interview.sequence && total > 1 ? `Interview ${interview.sequence} of ${total}` : "Interview";
  return (
    <li
      className={`rounded-lg border px-3 py-3 ${
        latest ? "border-[color:var(--brand-primary)]/40 bg-white" : "border-slate-200 bg-white"
      } ${interview.status === "cancelled" ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            {name}
            {latest ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)",
                  color: "var(--brand-primary)",
                }}
              >
                Latest
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 break-words text-xs text-slate-600">{interview.title}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            STEP_PILL_TONE_CLASSES[candidateInterviewStatusTone(interview.status)]
          }`}
        >
          {candidateInterviewStatusLabel(interview.status)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Meta label="Date" value={formatInterviewDate(interview.startsAt)} />
        <Meta
          label="Time"
          value={`${formatInterviewTimeRange(interview.startsAt, interview.endsAt)} ET`}
        />
        <Meta
          label="Meeting type"
          value={interview.meetingType ? MEETING_TYPE_LABELS[interview.meetingType] ?? titleCase(interview.meetingType) : null}
        />
        <Meta
          label="Interviewers"
          value={interview.interviewers.map((person) => person.name).join(", ") || null}
        />
        {interview.location ? <Meta label="Location" value={interview.location} /> : null}
        <Meta label="Booked" value={formatDateTime(interview.createdAt)} />
      </dl>
      {interview.meetingLink ? (
        <a
          href={interview.meetingLink}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block break-all text-xs font-semibold text-[color:var(--brand-primary)] hover:underline"
        >
          Join meeting
        </a>
      ) : null}
      {interview.notes ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {interview.notes}
        </p>
      ) : null}
    </li>
  );
}

export default function CandidateWorkflowStepModal({
  open,
  onOpenChange,
  loading,
  error,
  inspection,
  workerId,
  onStepUpdated,
  onScheduleInterview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  error?: string | null;
  inspection: WorkflowStepInspection | null;
  /** Enables complete / reject / reopen for staff-owned steps. */
  workerId?: string;
  onStepUpdated?: () => void | Promise<void>;
  /** Shown on interview steps until the interview outcome is recorded. */
  onScheduleInterview?: () => void;
}) {
  const branding = useTenantBranding();
  const title = inspection?.step.title ?? "Step details";
  const stepId = inspection?.step.id ?? null;
  const [pendingAction, setPendingAction] = useState<StaffStepAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  useEffect(() => {
    setPendingAction(null);
    setActionError(null);
    setNotice(null);
  }, [stepId, open]);

  // Radix portals render outside the branding wrapper, so re-declare the vars here
  // and drive the header/button colours straight from the tenant palette. The header
  // stays a light brand wash so the secondary-coloured title keeps its contrast.
  const brandStyle = useMemo(
    () => ({
      ...brandingToCssVars(branding),
      "--step-modal-header": `linear-gradient(135deg, color-mix(in srgb, ${branding.primaryHex} 16%, white) 0%, color-mix(in srgb, ${branding.secondaryHex} 8%, white) 100%)`,
      "--step-modal-cta": `linear-gradient(90deg, ${branding.primaryHex} 0%, color-mix(in srgb, ${branding.primaryHex} 74%, white) 100%)`,
      "--step-modal-icon": `linear-gradient(135deg, ${branding.primaryHex} 0%, color-mix(in srgb, ${branding.primaryHex} 65%, white) 100%)`,
      "--step-modal-on-primary": readableTextOnBrand(branding.primaryHex),
      "--step-modal-on-secondary": readableTextOnBrand(branding.secondaryHex),
    }) as React.CSSProperties,
    [branding]
  );

  const staffAction = inspection?.staffAction;
  const staffReview = inspection?.staffReview ?? null;
  const canAct = Boolean(workerId && staffAction?.allowed && staffAction.actions.length);
  const KindIcon = inspection ? KIND_ICONS[inspection.kind] : Layers;
  const variant = staffAction?.variant ?? "default";
  const statusLabel = inspection ? stepDisplayStatusLabel(inspection.step) : "";
  const interviewState = inspection ? interviewStepStatus(inspection.step) : null;
  const statusTone = !inspection
    ? ""
    : interviewState
      ? STEP_PILL_TONE_CLASSES[interviewState.tone]
      : isDecisionVariant(staffStepVariantForLibraryId(inspection.step.stepType))
        ? STATUS_TONE[DECISION_TONE[inspection.step.displayStatus] ?? inspection.step.displayStatus]
        : STATUS_TONE[inspection.step.displayStatus];
  const interviews = inspection?.interviews ?? null;
  const interviewsNewestFirst = useMemo(
    () => (interviews ? [...interviews].reverse() : []),
    [interviews]
  );
  const latestInterviewId = inspection?.step.interview?.latest?.id ?? null;
  const activeInterviewCount = inspection?.step.interview?.count ?? 0;
  const canSchedule = Boolean(
    onScheduleInterview &&
      interviewState &&
      interviewState.key !== "completed" &&
      interviewState.key !== "rejected"
  );
  const showFooter = !loading && !error && (canSchedule || (canAct && staffAction));

  async function submitAction(input: { note: string; notifyCandidate: boolean }) {
    if (!workerId || !stepId || !pendingAction) return;
    const action = pendingAction;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/workflow-steps/${encodeURIComponent(stepId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: input.note || null,
            notifyCandidate: input.notifyCandidate,
            clientOrigin: window.location.origin,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: StaffStepEmailResult | null;
      };
      if (!res.ok) throw new Error(json.error || "Failed to update this step.");
      setPendingAction(null);
      setNotice(
        action === "reject" && variant === "default" && inspection && !inspection.step.required
          ? { tone: "success", message: "Step rejected. It's optional, so it doesn't block the candidate's next stage." }
          : action === "complete" && variant === "interview" && !json.email
            ? { tone: "success", message: "Interview marked as completed." }
          : staffActionResultMessage(action, json.email ?? null, variant)
      );
      await onStepUpdated?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update this step.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-[2px]" />
        <Dialog.Content
          style={brandStyle}
          className="fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-2rem)] w-[min(58rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
          aria-describedby="workflow-step-inspection-desc"
        >
          <div
            className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4"
            style={{ background: "var(--step-modal-header)" }}
          >
            <span
              aria-hidden
              className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
              style={{ background: "var(--step-modal-icon)", color: "var(--step-modal-on-primary)" }}
            >
              <KindIcon className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <Dialog.Title
                className="truncate text-lg font-semibold leading-6"
                style={{ color: "var(--brand-secondary)" }}
              >
                {title}
              </Dialog.Title>
              <Dialog.Description id="workflow-step-inspection-desc" className="mt-1 text-xs text-slate-600">
                {inspection
                  ? [
                      lifecyclePhaseLabel(inspection.phase),
                      titleCase(inspection.step.stepType),
                      inspection.step.required ? "Required" : "Optional",
                    ].join(" · ")
                  : "Candidate workflow step"}
              </Dialog.Description>
              {inspection ? (
                <p className="mt-2 text-xs text-slate-600">
                  {staffAction?.allowed
                    ? `Internal step owned by ${staffAction.ownerLabel ?? "your team"}. Complete it here to unlock the candidate's next step.`
                    : "Read-only submission from the candidate."}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {inspection ? (
                <span
                  className={`hidden rounded-full px-3 py-1 text-xs font-semibold ring-1 sm:inline-block ${statusTone}`}
                >
                  {statusLabel}
                </span>
              ) : null}
              <Dialog.Close
                className="inline-flex size-9 items-center justify-center rounded-full shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-secondary)]"
                style={{
                  backgroundColor: "var(--brand-secondary)",
                  color: "var(--step-modal-on-secondary)",
                }}
                aria-label="Close step details"
              >
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] px-5 py-4">
            {notice ? (
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  notice.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {notice.message}
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-3" aria-busy>
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-32 animate-pulse rounded-xl bg-slate-200/70" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : !inspection ? (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                No submission details are available for this step.
              </p>
            ) : (
              <>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 sm:hidden ${statusTone}`}
                >
                  {statusLabel}
                </span>

                {inspection.emptyState ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {inspection.emptyState}
                  </p>
                ) : null}

                {interviews ? (
                  <Section title="Interviews" count={activeInterviewCount}>
                    {interviewsNewestFirst.length ? (
                      <ul className="space-y-3">
                        {interviewsNewestFirst.map((interview) => (
                          <InterviewCard
                            key={interview.id}
                            interview={interview}
                            total={activeInterviewCount}
                            latest={interview.id === latestInterviewId}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">No interviews booked with this candidate yet.</p>
                    )}
                  </Section>
                ) : null}

                {inspection.checkResult ? (
                  <Section
                    title={inspection.checkResult.kind === "facility" ? "Facility approval" : "Compliance check"}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{inspection.checkResult.typeLabel}</p>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          STEP_PILL_TONE_CLASSES[inspection.checkResult.tone]
                        }`}
                      >
                        {inspection.checkResult.statusLabel}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {inspection.checkResult.kind === "facility" ? (
                        <Meta label="Facility" value={inspection.checkResult.facilityName} />
                      ) : (
                        <>
                          <Meta label="Vendor" value={inspection.checkResult.vendorName} />
                          <Meta label="Reference" value={inspection.checkResult.externalRef} />
                        </>
                      )}
                      <Meta label="Result date" value={formatDateTime(inspection.checkResult.completedAt)} />
                      <Meta label="Recorded by" value={inspection.checkResult.completedByName} />
                    </dl>
                    {inspection.checkResult.resultSummary ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                        {inspection.checkResult.resultSummary}
                      </p>
                    ) : null}
                  </Section>
                ) : null}

                <Section title="Overview">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Meta label="Step name" value={inspection.step.title} />
                    <Meta label="Step type" value={titleCase(inspection.step.stepType)} />
                    <Meta label="Phase" value={lifecyclePhaseLabel(inspection.phase)} />
                    <Meta
                      label="Requirement"
                      value={inspection.step.required ? "Required" : "Optional"}
                    />
                    <Meta label="Completed by" value={inspection.completedBy} />
                    <Meta
                      label="Owner"
                      value={staffAction?.allowed ? staffAction.ownerLabel : "Candidate"}
                    />
                    <Meta label="Workflow" value={inspection.workflowName} />
                    <Meta label="Workflow version" value={inspection.workflowVersion} />
                    <Meta label="Approved or rejected by" value={inspection.approvedOrRejectedBy} />
                  </dl>
                </Section>

                {/* Timeline hidden from step details.
                <Section title="Timeline">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Meta label="Assigned" value={formatDateTime(inspection.assignedAt)} />
                    <Meta label="Started" value={formatDateTime(inspection.startedAt)} />
                    <Meta label="Submitted" value={formatDateTime(inspection.submittedAt)} />
                    <Meta label="Completed" value={formatDateTime(inspection.completedAt)} />
                    <Meta
                      label="Approved or rejected"
                      value={formatDateTime(inspection.approvedOrRejectedAt)}
                    />
                  </dl>
                </Section>
                */}

                {staffReview ? (
                  <Section title={variant === "interview" ? "Interview outcome" : "Internal review"}>
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Meta
                        label="Decision"
                        value={
                          isDecisionVariant(variant) && staffReview.decision !== "reopen"
                            ? decisionLabel(variant, staffReview.decision)
                            : staffReview.decision === "complete"
                              ? "Completed"
                              : staffReview.decision === "reject"
                                ? "Rejected"
                                : titleCase(staffReview.decision)
                        }
                      />
                      <Meta label="Reviewed by" value={staffReview.reviewedByName} />
                      <Meta label="Reviewed at" value={formatDateTime(staffReview.reviewedAt)} />
                    </dl>
                    {staffReview.note ? (
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {staffReview.note}
                      </p>
                    ) : null}
                  </Section>
                ) : null}

                {inspection.notes && inspection.notes !== staffReview?.note ? (
                  <Section title="Notes or rejection reason">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{inspection.notes}</p>
                  </Section>
                ) : null}

                {inspection.documents.length > 0 ? (
                  <Section title="Uploaded documents" count={inspection.documents.length}>
                    <ul className="space-y-3">
                      {inspection.documents.map((doc) => (
                        <li key={doc.id} className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="break-words text-sm font-medium text-slate-900">
                            {doc.originalFileName || "Uploaded file"}
                          </p>
                          <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                            <div>Type: {doc.documentType || "—"}</div>
                            <div>Size: {formatBytes(doc.fileSize)}</div>
                            <div>Uploaded: {formatDateTime(doc.uploadedAt)}</div>
                            <div>Uploaded by: {doc.uploadedBy || "—"}</div>
                            <div>Verification: {doc.verificationStatus || "—"}</div>
                            <div>Reviewed: {formatDateTime(doc.approvedOrRejectedAt)}</div>
                          </dl>
                          {doc.reviewNotes ? (
                            <p className="mt-1 text-xs text-rose-700">{doc.reviewNotes}</p>
                          ) : null}
                          {doc.fileUnavailable ? (
                            <p className="mt-2 text-xs text-amber-800">File unavailable.</p>
                          ) : doc.previewUrl ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href={doc.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]"
                                style={{
                                  borderColor: "var(--brand-primary)",
                                  color: "var(--brand-primary)",
                                  backgroundColor: "color-mix(in srgb, var(--brand-primary) 6%, white)",
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden />
                                Preview
                              </a>
                              <a
                                href={doc.downloadUrl ?? doc.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={doc.originalFileName ?? true}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]"
                                style={{
                                  background: "var(--step-modal-cta)",
                                  color: "var(--step-modal-on-primary)",
                                }}
                              >
                                <Download className="h-3.5 w-3.5" aria-hidden />
                                Download
                              </a>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                {inspection.form?.questions.length ? (
                  <Section title="Form responses" count={inspection.form.questions.length}>
                    <ul className="space-y-3">
                      {inspection.form.questions.map((question, index) => (
                        <li
                          key={`${question.label}-${index}`}
                          className="rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-slate-900">{question.label}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {formatAnswer(question.answer)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {question.fieldType} · {formatDateTime(question.submittedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                {inspection.assessment ? (
                  <Section
                    title="Skill assessment results"
                    count={inspection.assessment.summary.totalCategories}
                  >
                    <SkillAssessmentResults
                      startedAt={formatDateTime(inspection.assessment.startedAt)}
                      completedAt={formatDateTime(inspection.assessment.completedAt)}
                      summary={inspection.assessment.summary}
                      categories={inspection.assessment.categories}
                    />
                  </Section>
                ) : null}

                {inspection.references.length ? (
                  <Section title="References" count={inspection.references.length}>
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {inspection.references.map((reference) => (
                        <li
                          key={reference.id}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        >
                          <p className="font-medium text-slate-900">{reference.name}</p>
                          <p className="text-slate-600">{reference.relationship || "—"}</p>
                          <p className="break-words text-slate-600">
                            {reference.email || "—"}
                            {reference.phone ? ` · ${reference.phone}` : ""}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Submitted {formatDateTime(reference.submittedAt)}
                          </p>
                          {reference.recruiterNotes ? (
                            <p className="mt-1 text-xs text-slate-700">{reference.recruiterNotes}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                {inspection.agreement ? (
                  <Section title="eSignature">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Meta label="Agreement" value={inspection.agreement.documentName} />
                      <Meta label="Signature status" value={inspection.agreement.signatureStatus} />
                      <Meta label="Sent" value={formatDateTime(inspection.agreement.sentAt)} />
                      <Meta label="Viewed" value={formatDateTime(inspection.agreement.viewedAt)} />
                      <Meta label="Signed" value={formatDateTime(inspection.agreement.signedAt)} />
                      <Meta label="Signer" value={inspection.agreement.signerIdentity} />
                    </dl>
                    {inspection.agreement.completedDocumentUrl ? (
                      <a
                        href={inspection.agreement.completedDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-xs font-semibold text-[color:var(--brand-primary)] hover:underline"
                      >
                        View completed document
                      </a>
                    ) : null}
                  </Section>
                ) : null}

                {inspection.authorization && inspection.kind === "background_check" ? (
                  <Section title="Authorization">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Meta
                        label="Authorization status"
                        value={inspection.authorization.authorizationStatus}
                      />
                      <Meta
                        label="Consent timestamp"
                        value={formatDateTime(inspection.authorization.consentTimestamp)}
                      />
                      <Meta
                        label="Provider status"
                        value={inspection.authorization.providerSafeStatus}
                      />
                      <Meta label="Review status" value={inspection.authorization.reviewStatus} />
                    </dl>
                  </Section>
                ) : null}

                {inspection.finalReview ? (
                  <Section title="Final review">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Meta
                        label="Submitted"
                        value={formatDateTime(inspection.finalReview.submittedAt)}
                      />
                      <Meta
                        label="Candidate confirmation"
                        value={inspection.finalReview.confirmation}
                      />
                      <Meta label="Reviewer" value={inspection.finalReview.reviewer} />
                      <Meta label="Decision" value={inspection.finalReview.decision} />
                    </dl>
                    {inspection.finalReview.missingRequirements.length ? (
                      <p className="mt-3 text-sm text-amber-800">
                        Missing at submission: {inspection.finalReview.missingRequirements.join(", ")}
                      </p>
                    ) : null}
                    {inspection.finalReview.stepsIncluded.length ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Steps included: {inspection.finalReview.stepsIncluded.join(", ")}
                      </p>
                    ) : null}
                  </Section>
                ) : null}
              </>
            )}
          </div>

          {showFooter ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <p className="text-xs text-slate-500">
                Owner:{" "}
                <span className="font-semibold text-slate-700">
                  {staffAction?.ownerLabel ?? "Internal team"}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {canSchedule ? (
                  <button
                    type="button"
                    onClick={onScheduleInterview}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
                    style={{
                      borderColor: "var(--brand-primary)",
                      color: "var(--brand-primary)",
                    }}
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    {activeInterviewCount > 0 ? "Schedule Another Interview" : "Schedule Interview"}
                  </button>
                ) : null}
                {(canAct ? staffAction?.actions ?? [] : []).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setPendingAction(action);
                    }}
                    disabled={submitting}
                    style={
                      action === "complete"
                        ? {
                            background: "var(--step-modal-cta)",
                            color: "var(--step-modal-on-primary)",
                          }
                        : undefined
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      action === "complete"
                        ? "shadow-sm hover:brightness-[0.97]"
                        : action === "reject"
                          ? "border border-red-300 text-red-700 hover:bg-red-50"
                          : action === "needs_review"
                            ? "border border-amber-300 text-amber-800 hover:bg-amber-50"
                            : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {staffActionLabel(action, variant)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
      <WorkflowStepStaffActionModal
        action={pendingAction}
        variant={variant}
        optional={inspection ? !inspection.step.required : false}
        stepTitle={title}
        submitting={submitting}
        error={actionError}
        onCancel={() => {
          setPendingAction(null);
          setActionError(null);
        }}
        onConfirm={(input) => void submitAction(input)}
      />
    </Dialog.Root>
  );
}
