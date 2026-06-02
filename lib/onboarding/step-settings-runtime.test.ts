import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { evaluateConditionalLogic } from "@/lib/onboarding/evaluate-conditional-logic";
import { dispatchWorkflowIntegrationPartner } from "@/lib/onboarding/integration-partner-dispatch";
import { notifyHrOnOnboardingStepFailure } from "@/lib/onboarding/notify-hr-on-step-failure";
import {
  shouldPauseFlowOnStepFailure,
  isWorkerVisibleStep,
} from "@/lib/onboarding/workflow-settings";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/communication/send-candidate-email", () => ({
  sendCandidateEmail: vi.fn().mockResolvedValue({ ok: true, messageId: "msg-1" }),
}));

vi.mock("@/lib/onboarding/resolve-hr-notify-emails", () => ({
  resolveHrNotifyEmails: vi.fn().mockResolvedValue(["hr@example.com"]),
}));

import { writeActivityLog } from "@/lib/audit/activity-log";
import { sendCandidateEmail } from "@/lib/communication/send-candidate-email";

const baseStep = (metadata: Record<string, unknown>): TenantOnboardingStep => ({
  id: "step-1",
  step_key: "background_check",
  title: "Background check",
  description: null,
  step_type: "custom_question",
  sort_order: 10,
  is_required: true,
  is_enabled: true,
  metadata,
});

describe("evaluateConditionalLogic", () => {
  it("detects hide-from-applicant prefixes", () => {
    expect(evaluateConditionalLogic("admin only — internal").hideFromApplicant).toBe(true);
    expect(evaluateConditionalLogic("hide from applicant").hideFromApplicant).toBe(true);
    expect(evaluateConditionalLogic("").hideFromApplicant).toBe(false);
  });

  it("detects pause-on-fail phrases", () => {
    expect(evaluateConditionalLogic("If result = fail → Pause flow + notify").pauseFlowOnFail).toBe(
      true
    );
    expect(evaluateConditionalLogic("pause flow when fail").pauseFlowOnFail).toBe(true);
    expect(evaluateConditionalLogic("always show").pauseFlowOnFail).toBe(false);
  });
});

describe("shouldPauseFlowOnStepFailure", () => {
  it("reads pause flag from workflow_settings.conditionalLogic", () => {
    const step = baseStep({
      workflow_settings: {
        conditionalLogic: "If result = fail → Pause flow + notify",
        clientPerforms: true,
        required: true,
        useBraasPartner: false,
        notifyHrOnFail: true,
        datePriority: "Day 1",
        provider: "Manual",
        triggerAfter: "",
        notify: "",
        timeline: "",
      },
    });
    expect(shouldPauseFlowOnStepFailure(step)).toBe(true);
  });
});

describe("isWorkerVisibleStep with conditionalLogic", () => {
  it("hides admin-only steps", () => {
    const step = baseStep({
      workflow_settings: {
        conditionalLogic: "admin only",
        clientPerforms: true,
        required: true,
        useBraasPartner: false,
        notifyHrOnFail: false,
        datePriority: "Day 1",
        provider: "Manual",
        triggerAfter: "",
        notify: "",
        timeline: "",
      },
    });
    expect(isWorkerVisibleStep(step)).toBe(false);
  });
});

describe("dispatchWorkflowIntegrationPartner", () => {
  const supabase = {} as never;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("skips dispatch when integration partner is disabled", async () => {
    const step = baseStep({
      workflow_settings: {
        useBraasPartner: false,
        provider: "Manual",
        clientPerforms: true,
        required: true,
        notifyHrOnFail: false,
        datePriority: "Day 1",
        triggerAfter: "",
        notify: "",
        timeline: "",
        conditionalLogic: "",
      },
    });

    const result = await dispatchWorkflowIntegrationPartner({
      supabase,
      tenantId: "t1",
      workerId: "w1",
      applicantId: "a1",
      step,
    });

    expect(result.mode).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns not_configured for Checker when API URL is missing", async () => {
    delete process.env.CHECKER_PARTNER_API_URL;
    const step = baseStep({
      workflow_settings: {
        useBraasPartner: true,
        provider: "Checker (connected)",
        clientPerforms: true,
        required: true,
        notifyHrOnFail: false,
        datePriority: "Day 1",
        triggerAfter: "",
        notify: "",
        timeline: "",
        conditionalLogic: "",
      },
    });

    const result = await dispatchWorkflowIntegrationPartner({
      supabase,
      tenantId: "t1",
      workerId: "w1",
      applicantId: "a1",
      step,
    });

    expect(result.status).toBe("not_configured");
    expect(writeActivityLog).toHaveBeenCalled();
  });
});

describe("notifyHrOnOnboardingStepFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes audit log and attempts HR email when enabled", async () => {
    const step = baseStep({
      workflow_settings: {
        notifyHrOnFail: true,
        clientPerforms: true,
        required: true,
        useBraasPartner: false,
        datePriority: "Day 1",
        provider: "Manual",
        triggerAfter: "",
        notify: "",
        timeline: "",
        conditionalLogic: "",
      },
    });

    const result = await notifyHrOnOnboardingStepFailure({
      supabase: {} as never,
      tenantId: "t1",
      workerId: "w1",
      applicantId: "a1",
      step,
      failureReason: "parse error",
    });

    expect(result.auditLogged).toBe(true);
    expect(result.emailsSent).toBe(1);
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "onboarding_step_failed_notify_hr" })
    );
    expect(sendCandidateEmail).toHaveBeenCalled();
  });

  it("skips when notify HR on fail is disabled", async () => {
    const step = baseStep({
      workflow_settings: {
        notifyHrOnFail: false,
        clientPerforms: true,
        required: true,
        useBraasPartner: false,
        datePriority: "Day 1",
        provider: "Manual",
        triggerAfter: "",
        notify: "",
        timeline: "",
        conditionalLogic: "",
      },
    });

    const result = await notifyHrOnOnboardingStepFailure({
      supabase: {} as never,
      tenantId: "t1",
      workerId: "w1",
      applicantId: "a1",
      step,
    });

    expect(result.auditLogged).toBe(false);
    expect(sendCandidateEmail).not.toHaveBeenCalled();
  });
});
