"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApplicantStepStatus,
  PublishedWorkflow,
  PublishedWorkflowStep,
} from "@/lib/onboarding/applicant-workflow-types";
import {
  getApplicantWorkflowSteps,
  normalizeWorkflowSteps,
} from "@/lib/onboarding/applicant-workflow";
import ApplicantProgressTracker from "@/app/components/onboarding/ApplicantProgressTracker";
import ApplicantStepPage from "@/app/components/onboarding/ApplicantStepPage";

export type ApplicantOnboardingApi = {
  getApplicantWorkflow: (params: {
    tenant: string;
    applicationId: string;
  }) => Promise<PublishedWorkflow>;
  getApplicantStepStatuses?: (params: {
    applicationId: string;
    workflow: PublishedWorkflow;
  }) => Promise<ApplicantStepStatus[]>;
  completeStep?: (params: {
    applicationId: string;
    workflowId: string;
    workflowVersion: number;
    stepId: string;
    status: ApplicantStepStatus["status"];
  }) => Promise<ApplicantStepStatus>;
};

type Props = {
  tenant: string;
  applicationId: string;
  api?: ApplicantOnboardingApi;
};

const defaultApi: ApplicantOnboardingApi = {
  async getApplicantWorkflow({ tenant, applicationId }) {
    const res = await fetch(
      `/api/applications/${encodeURIComponent(applicationId)}/onboarding-workflow?tenant=${encodeURIComponent(tenant)}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error("Could not load onboarding workflow");
    }
    return (await res.json()) as PublishedWorkflow;
  },
};

function findCurrentStep(
  steps: PublishedWorkflowStep[],
  statuses: ApplicantStepStatus[],
  showSummary: boolean
): PublishedWorkflowStep | "summary" | null {
  if (showSummary) return "summary";
  const statusById = new Map(statuses.map((s) => [s.stepId, s.status]));
  const incomplete = steps.find((step) => {
    const status = statusById.get(step.id);
    return status !== "completed" && status !== "skipped";
  });
  return incomplete ?? steps[steps.length - 1] ?? null;
}

export default function ApplicantOnboardingPage({
  tenant,
  applicationId,
  api = defaultApi,
}: Props) {
  const [workflow, setWorkflow] = useState<PublishedWorkflow | null>(null);
  const [statuses, setStatuses] = useState<ApplicantStepStatus[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(
    () => (workflow ? getApplicantWorkflowSteps(workflow) : []),
    [workflow]
  );

  const current = useMemo(() => {
    if (!workflow) return null;
    return findCurrentStep(steps, statuses, showSummary);
  }, [workflow, steps, statuses, showSummary]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wf = await api.getApplicantWorkflow({ tenant, applicationId });
      setWorkflow(wf);
      if (api.getApplicantStepStatuses) {
        const nextStatuses = await api.getApplicantStepStatuses({
          applicationId,
          workflow: wf,
        });
        setStatuses(nextStatuses);
      } else {
        setStatuses(
          normalizeWorkflowSteps(wf.steps).map((step) => ({
            stepId: step.id,
            status: "not_started",
          }))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load onboarding");
    } finally {
      setLoading(false);
    }
  }, [api, applicationId, tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentStepId =
    current && current !== "summary" ? current.id : steps[steps.length - 1]?.id ?? null;

  const currentStatus = useMemo(() => {
    if (!current || current === "summary") return null;
    return statuses.find((s) => s.stepId === current.id) ?? null;
  }, [current, statuses]);

  const currentIndex = useMemo(() => {
    if (!current || current === "summary") return steps.length;
    return steps.findIndex((s) => s.id === current.id);
  }, [current, steps]);

  async function handleContinue() {
    if (!workflow || !current || current === "summary") return;

    if (api.completeStep) {
      const updated = await api.completeStep({
        applicationId,
        workflowId: workflow.workflowId,
        workflowVersion: workflow.version,
        stepId: current.id,
        status: "completed",
      });
      setStatuses((prev) => {
        const rest = prev.filter((s) => s.stepId !== current.id);
        return [...rest, updated];
      });
    } else {
      setStatuses((prev) => {
        const rest = prev.filter((s) => s.stepId !== current.id);
        return [...rest, { stepId: current.id, status: "completed" }];
      });
    }

    const next = steps[currentIndex + 1];
    if (!next) {
      setShowSummary(true);
    }
  }

  async function handleSkip() {
    if (!workflow || !current || current === "summary" || current.required) return;
    if (api.completeStep) {
      const updated = await api.completeStep({
        applicationId,
        workflowId: workflow.workflowId,
        workflowVersion: workflow.version,
        stepId: current.id,
        status: "skipped",
      });
      setStatuses((prev) => {
        const rest = prev.filter((s) => s.stepId !== current.id);
        return [...rest, updated];
      });
    }
  }

  if (loading) {
    return <p>Loading onboarding…</p>;
  }

  if (error || !workflow) {
    return <p role="alert">{error ?? "Onboarding unavailable"}</p>;
  }

  const allComplete = steps.every((step) => {
    const status = statuses.find((s) => s.stepId === step.id)?.status;
    return status === "completed" || status === "skipped";
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <ApplicantProgressTracker workflow={workflow} currentStepId={currentStepId} />

      {allComplete ? (
        <button
          type="button"
          onClick={() => setShowSummary(true)}
          className="text-sm font-medium text-slate-700 underline"
        >
          Summary
        </button>
      ) : null}

      {current === "summary" || showSummary ? (
        <section aria-label="Summary">
          <h2 className="text-xl font-semibold text-slate-900">Summary</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review your completed onboarding steps before submitting.
          </p>
        </section>
      ) : current ? (
        <ApplicantStepPage
          step={current}
          status={currentStatus}
          onContinue={() => void handleContinue()}
          onSkip={() => void handleSkip()}
        />
      ) : null}
    </div>
  );
}
