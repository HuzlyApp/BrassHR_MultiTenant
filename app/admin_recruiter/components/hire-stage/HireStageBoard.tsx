"use client";

import { useMemo, useState } from "react";
import CandidateWorkflowStepDrawer from "@/app/admin_recruiter/components/CandidateWorkflowStepDrawer";
import { ScheduleInterviewModal } from "@/app/admin_recruiter/calendar/components/ScheduleInterviewModal";
import {
  invitationSuccessMessage,
  type InterviewInvitationSummary,
  type ScheduleInterviewPayload,
} from "@/lib/interviews/schedule-payload";
import SuccessModal from "@/app/components/SuccessModal";
import type {
  CandidateWorkflowAssignmentView,
  CandidateWorkflowPhaseView,
  CandidateWorkflowStepView,
} from "@/lib/onboarding/candidate-workflow-phase-view";
import type { WorkflowStepInspection } from "@/lib/onboarding/candidate-workflow-step-inspection";
import {
  groupStepsIntoHireStages,
  hireStageProgressMeta,
  type HireStageLifecycle,
} from "@/lib/onboarding/hire-stage-groups";
import { HireStageAccordion } from "./HireStageAccordion";
import { HireStageSidebar, type HireStageSidebarProfile } from "./HireStageSidebar";
import { HireStageStepper } from "./HireStageStepper";

function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HireStageBoard({
  workerId,
  lifecycle,
  loading,
  error,
  assigned,
  emptyMessage,
  steps,
  assignment,
  phaseView,
  profile,
  activationFailed,
  onRequestPostHireTab,
}: {
  workerId?: string;
  lifecycle: HireStageLifecycle;
  loading?: boolean;
  error?: string | null;
  assigned: boolean;
  emptyMessage: string;
  steps: CandidateWorkflowStepView[];
  assignment?: CandidateWorkflowAssignmentView | null;
  phaseView?: CandidateWorkflowPhaseView | null;
  profile: HireStageSidebarProfile & {
    email?: string | null;
    phone?: string | null;
  };
  activationFailed?: boolean;
  onRequestPostHireTab?: () => void;
}) {
  const stages = useMemo(() => groupStepsIntoHireStages(steps, lifecycle), [steps, lifecycle]);
  const progressMeta = useMemo(() => hireStageProgressMeta(stages), [stages]);

  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<WorkflowStepInspection | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const title = lifecycle === "pre_hire" ? "Pre-hire" : "Post-hire";
  const subtitle =
    lifecycle === "pre_hire"
      ? "Track every step before someone becomes part of your team."
      : "Track onboarding steps after the candidate joins your team.";

  const preHireComplete =
    lifecycle === "pre_hire" &&
    assigned &&
    steps.length > 0 &&
    progressMeta.percent === 100;

  const proceedDisabledReason = !phaseView?.postHireVisible
    ? "Convert / Approve as Worker to unlock Post-Hire."
    : phaseView.postHireLocked
      ? "Post-Hire is locked until hire activation completes."
      : null;

  async function openStep(step: CandidateWorkflowStepView) {
    if (!workerId) return;
    setOpenStepId(step.id);
    setInspection(null);
    setInspectionError(null);
    setInspectionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/workflow-steps/${encodeURIComponent(step.id)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as WorkflowStepInspection & { error?: string };
      if (!res.ok) {
        setInspectionError(json.error || "Failed to load step details.");
        return;
      }
      setInspection(json);
    } catch (err) {
      setInspectionError(err instanceof Error ? err.message : "Failed to load step details.");
    } finally {
      setInspectionLoading(false);
    }
  }

  async function handleSchedule(payload: ScheduleInterviewPayload) {
    setScheduleSubmitting(true);
    setScheduleError(null);
    try {
      const res = await fetch("/api/admin/applicant-appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        invitation?: InterviewInvitationSummary;
      };
      if (!res.ok) throw new Error(json.error || "Failed to schedule interview");
      setScheduleOpen(false);
      setScheduleSuccess(invitationSuccessMessage(json.invitation));
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed to schedule interview");
    } finally {
      setScheduleSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-10 text-sm text-[#64748B]">
        Loading {title} workflow…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!assigned) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-8 text-sm text-[#64748B]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <header>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: "var(--brand-secondary)" }}
            >
              {title}
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>
          </header>

          {activationFailed ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Candidate is hired but Post-Hire activation did not complete. Retry status change or
              conversion.
            </div>
          ) : null}

          <HireStageStepper stages={stages} />
          <HireStageAccordion
            stages={stages}
            onInspectStep={(step) => void openStep(step)}
            onScheduleInterview={
              lifecycle === "pre_hire" ? () => setScheduleOpen(true) : undefined
            }
          />
        </div>

        <HireStageSidebar
          lifecycle={lifecycle}
          profile={profile}
          templateName={assignment?.workflowName ?? phaseView?.currentWorkflowName ?? null}
          progressPercent={progressMeta.percent}
          progressLabel={progressMeta.label}
          lastUpdated={formatLongDate(phaseView?.phaseStartedAt ?? assignment?.assignedAt)}
          showProceedToPostHire={lifecycle === "pre_hire" && preHireComplete}
          proceedDisabledReason={proceedDisabledReason}
          onProceedToPostHire={() => {
            if (proceedDisabledReason) return;
            onRequestPostHireTab?.();
          }}
        />
      </div>

      <CandidateWorkflowStepDrawer
        open={Boolean(openStepId)}
        onOpenChange={(open) => {
          if (!open) {
            setOpenStepId(null);
            setInspection(null);
            setInspectionError(null);
          }
        }}
        loading={inspectionLoading}
        error={inspectionError}
        inspection={inspection}
      />

      {workerId ? (
        <ScheduleInterviewModal
          open={scheduleOpen}
          applicants={[
            {
              id: workerId,
              name: profile.name || "Candidate",
              status: "interview",
            },
          ]}
          submitting={scheduleSubmitting}
          error={scheduleError}
          onClose={() => {
            setScheduleOpen(false);
            setScheduleError(null);
          }}
          onSubmit={(payload) => void handleSchedule(payload)}
          fixedWorkerId={workerId}
          fixedApplicantName={profile.name || "Candidate"}
        />
      ) : null}
      <SuccessModal
        open={Boolean(scheduleSuccess)}
        onClose={() => setScheduleSuccess(null)}
        title="Interview scheduled"
        message={scheduleSuccess || ""}
      />
    </>
  );
}
