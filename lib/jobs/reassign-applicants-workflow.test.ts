import { describe, expect, it } from "vitest";
import {
  matchExistingStepForWorkflowNode,
  planApplicantWorkflowReassignment,
} from "@/lib/jobs/reassign-applicants-workflow";
import type { StepRecordRow } from "@/lib/onboarding/sync-workflow-instances";

function step(
  partial: Partial<StepRecordRow> & {
    id?: string;
    status?: string | null;
    completed_at?: string | null;
  }
) {
  return {
    id: partial.id ?? "old-1",
    tenant_id: "tenant-1",
    workflow_instance_id: "inst-1",
    snapshot_step_id: partial.snapshot_step_id ?? "node-a",
    position: partial.position ?? 1,
    title: partial.title ?? "Background Check",
    step_type: partial.step_type ?? "background-check",
    is_required: partial.is_required ?? true,
    phase: partial.phase ?? "pre_hire",
    settings: partial.settings ?? { phase: "pre_hire" },
    status: partial.status ?? "pending",
    completed_at: partial.completed_at ?? null,
    status_changed_at: null,
    status_changed_by: null,
    status_changed_by_name: null,
    completed_by: null,
    review_decision: null,
    review_note: null,
  };
}

describe("matchExistingStepForWorkflowNode", () => {
  it("prefers exact snapshot_step_id", () => {
    const fresh: StepRecordRow = {
      tenant_id: "tenant-1",
      workflow_instance_id: "inst-1",
      snapshot_step_id: "node-a",
      position: 1,
      title: "Different Title",
      step_type: "other",
      is_required: true,
      phase: "pre_hire",
      settings: {},
    };
    const match = matchExistingStepForWorkflowNode(
      fresh,
      [
        step({ id: "keep", snapshot_step_id: "node-a", step_type: "background-check", status: "completed" }),
        step({ id: "other", snapshot_step_id: "node-b", step_type: "other" }),
      ],
      new Set()
    );
    expect(match?.id).toBe("keep");
  });

  it("falls back to step_type + phase + title", () => {
    const fresh: StepRecordRow = {
      tenant_id: "tenant-1",
      workflow_instance_id: "inst-1",
      snapshot_step_id: "it-node-1",
      position: 1,
      title: "Background Check",
      step_type: "background-check",
      is_required: true,
      phase: "pre_hire",
      settings: {},
    };
    const match = matchExistingStepForWorkflowNode(
      fresh,
      [
        step({
          id: "completed-bg",
          snapshot_step_id: "rnr-node-9",
          step_type: "background-check",
          title: "Background Check",
          status: "completed",
          completed_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
      new Set()
    );
    expect(match?.id).toBe("completed-bg");
  });
});

describe("planApplicantWorkflowReassignment", () => {
  it("preserves completed status on matched steps and inserts new ones as pending", () => {
    const plan = planApplicantWorkflowReassignment({
      tenantId: "tenant-1",
      instanceId: "inst-1",
      nodes: [
        {
          id: "it-bg",
          stepId: "background-check",
          label: "Background Check",
          required: true,
          settings: { phase: "pre_hire" },
        },
        {
          id: "it-it-training",
          stepId: "custom",
          label: "IT Security Training",
          required: true,
          settings: { phase: "pre_hire" },
        },
        {
          id: "it-post",
          stepId: "offer-letter",
          label: "Offer Letter",
          required: true,
          settings: { phase: "post_hire" },
        },
      ],
      oldRecords: [
        step({
          id: "old-bg",
          snapshot_step_id: "rnr-bg",
          step_type: "background-check",
          title: "Background Check",
          status: "completed",
          completed_at: "2026-02-01T12:00:00.000Z",
        }),
        step({
          id: "old-rnr-only",
          snapshot_step_id: "rnr-extra",
          step_type: "rnr-only-step",
          title: "R&R Only",
          status: "in_progress",
        }),
        step({
          id: "old-offer",
          snapshot_step_id: "rnr-offer",
          step_type: "offer-letter",
          title: "Offer Letter",
          phase: "post_hire",
          status: "pending",
        }),
      ],
    });

    expect(plan.deleteIds).toEqual(["old-rnr-only"]);
    expect(plan.updates).toHaveLength(2);
    const bg = plan.updates.find((row) => row.snapshot_step_id === "it-bg");
    expect(bg?.status).toBe("completed");
    expect(bg?.completed_at).toBe("2026-02-01T12:00:00.000Z");
    expect(bg?.id).toBe("old-bg");
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.snapshot_step_id).toBe("it-it-training");
  });
});
