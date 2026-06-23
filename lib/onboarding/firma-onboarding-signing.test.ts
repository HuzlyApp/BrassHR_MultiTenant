import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  mapFirmaStatusToOnboardingStatus,
  stepUsesFirmaSigning,
  getFirmaRecruiterTemplateId,
  findOnboardingStepForFirmaSession,
} from "@/lib/onboarding/firma-step-settings";
import {
  shouldCompleteOnboardingStepFromFirmaStatus,
  FirmaOnboardingSigningError,
  ensureFirmaSigningSession,
  mapFirmaSigningCreateError,
} from "@/lib/onboarding/firma-onboarding-signing";
import {
  resolveApplicantSigningRecipient,
  resolveFirmaRecipientSigningUrl,
} from "@/lib/firma/client";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";

describe("firma step settings", () => {
  it("detects Firma-enabled onboarding steps from workflow settings", () => {
    const step = {
      step_key: "employee_agreement",
      step_type: "authorizations" as const,
      metadata: {
        workflow_settings: {
          ...DEFAULT_STEP_SETTINGS,
          firmaRecruiterTemplateId: "tmpl-local-1",
          firmaRecruiterTemplateName: "Employee Agreement",
        },
      },
    };

    expect(getFirmaRecruiterTemplateId(step)).toBe("tmpl-local-1");
    expect(stepUsesFirmaSigning(step)).toBe(true);
  });

  it("persists attached Firma template settings when publishing workflow drafts", () => {
    const state: SerializableWorkflowState = {
      nodes: [
        {
          id: "node-1",
          stepId: "employee-agreement",
          label: "Employee Agreement",
          description: "Sign agreement",
          position: { x: 0, y: 0 },
          day: 1,
          required: true,
          settings: {
            ...DEFAULT_STEP_SETTINGS,
            firmaRecruiterTemplateId: "recruiter-template-1",
            firmaRecruiterTemplateName: "Employee Agreement",
          },
        },
      ],
      edges: [],
    };

    const drafts = workflowStateToStepDrafts(state);
    expect(drafts[0].metadata?.workflow_settings).toMatchObject({
      firmaRecruiterTemplateId: "recruiter-template-1",
      firmaRecruiterTemplateName: "Employee Agreement",
    });
  });

  it("routes Firma-enabled steps to the in-app signing page", () => {
    const route = routeForApplicantStep({
      step_key: "employee_agreement",
      step_type: "authorizations",
      metadata: {
        workflow_step_id: "employee-agreement",
        workflow_settings: {
          ...DEFAULT_STEP_SETTINGS,
          firmaRecruiterTemplateId: "recruiter-template-1",
        },
      },
    });

    expect(route).toContain(APPLICATION_ROUTES.firmaSign);
    expect(route).not.toContain(APPLICATION_ROUTES.authorizationsDocuments);
  });

  it("resolves Firma step by step id when URL stepKey is a duplicate alias", () => {
    const step = findOnboardingStepForFirmaSession(
      [
        {
          id: "step-uuid-2",
          step_key: "authorizations",
          title: "Employee Agreement",
          description: null,
          step_type: "authorizations",
          sort_order: 40,
          is_required: true,
          is_enabled: true,
          metadata: {
            workflow_settings: {
              ...DEFAULT_STEP_SETTINGS,
              firmaRecruiterTemplateId: "recruiter-template-1",
            },
          },
        },
      ],
      { stepKey: "authorizations_2", stepId: "step-uuid-2" }
    );

    expect(step?.id).toBe("step-uuid-2");
    expect(step?.step_key).toBe("authorizations");
  });
});

describe("firma status mapping", () => {
  it("maps Firma statuses to onboarding progress states", () => {
    expect(mapFirmaStatusToOnboardingStatus("sent")).toBe("in_progress");
    expect(mapFirmaStatusToOnboardingStatus("viewed")).toBe("in_progress");
    expect(mapFirmaStatusToOnboardingStatus("signed")).toBe("completed");
    expect(mapFirmaStatusToOnboardingStatus("completed")).toBe("completed");
    expect(mapFirmaStatusToOnboardingStatus("expired")).toBe("failed");
  });

  it("updates onboarding completion when Firma status becomes signed", async () => {
    expect(mapFirmaStatusToOnboardingStatus("signed")).toBe("completed");
    expect(shouldCompleteOnboardingStepFromFirmaStatus("signed")).toBe(true);
  });
});

describe("firma signing url helpers", () => {
  it("builds iframe URL from signing_request_user_id", () => {
    const url = resolveFirmaRecipientSigningUrl({ id: "recipient-1" });
    expect(url).toBe("https://app.firma.dev/signing/recipient-1");
  });

  it("prefers explicit signing_url from Firma recipient payload", () => {
    const url = resolveFirmaRecipientSigningUrl({
      id: "recipient-1",
      signing_url: "https://app.firma.dev/signing/custom",
    });
    expect(url).toBe("https://app.firma.dev/signing/custom");
  });

  it("selects applicant recipient by email", () => {
    const recipient = resolveApplicantSigningRecipient(
      {
        id: "req-1",
        recipients: [
          { id: "r-1", email: "other@example.com" },
          { id: "r-2", email: "applicant@example.com" },
        ],
      },
      "applicant@example.com"
    );
    expect(recipient?.id).toBe("r-2");
  });
});

describe("ensureFirmaSigningSession", () => {
  const originalKey = process.env.FIRMA_API_KEY;

  beforeEach(() => {
    process.env.FIRMA_API_KEY = "firma_test_key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/signing-requests") && !url.includes("/signing-requests/")) {
          return new Response(
            JSON.stringify({
              id: "signing-request-1",
              status: "sent",
              recipients: [
                {
                  id: "recipient-1",
                  email: "applicant@example.com",
                  signing_url: "https://app.firma.dev/signing/recipient-1",
                },
              ],
            }),
            { status: 201 }
          );
        }
        if (url.includes("/signing-requests/signing-request-1")) {
          return new Response(
            JSON.stringify({
              id: "signing-request-1",
              status: "signed",
              recipients: [
                {
                  id: "recipient-1",
                  email: "applicant@example.com",
                  status: "signed",
                  signing_url: "https://app.firma.dev/signing/recipient-1",
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.includes("/templates/firma-template-1")) {
          return new Response(
            JSON.stringify({
              id: "firma-template-1",
              name: "Employee Agreement",
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      })
    );
  });

  afterEach(() => {
    process.env.FIRMA_API_KEY = originalKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a Firma signing session when applicant reaches the step", async () => {
    const upsert = vi.fn().mockResolvedValue({
      data: {
        id: "session-1",
        tenant_id: "tenant-1",
        worker_id: "worker-1",
        onboarding_step_id: "step-1",
        recruiter_template_id: "recruiter-template-1",
        firma_template_id: "firma-template-1",
        signing_request_id: "signing-request-1",
        signing_request_user_id: "recipient-1",
        firma_status: "sent",
        iframe_url: "https://app.firma.dev/signing/recipient-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "recruiter_templates") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "recruiter-template-1",
                      tenant_id: "tenant-1",
                      name: "Employee Agreement",
                      status: "active",
                      firma_template_id: "firma-template-1",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "worker_firma_signing_sessions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            upsert: () => ({
              select: () => ({
                maybeSingle: upsert,
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const session = await ensureFirmaSigningSession({
      supabase: supabase as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      applicantEmail: "applicant@example.com",
      applicantFirstName: "Jane",
      applicantLastName: "Doe",
      step: {
        id: "step-1",
        step_key: "employee_agreement",
        title: "Employee Agreement",
        description: null,
        step_type: "authorizations",
        sort_order: 10,
        is_required: true,
        is_enabled: true,
        metadata: {
          workflow_settings: {
            ...DEFAULT_STEP_SETTINGS,
            firmaRecruiterTemplateId: "recruiter-template-1",
          },
        },
      },
    });

    expect(session.signing_request_id).toBe("signing-request-1");
    expect(session.iframe_url).toBe("https://app.firma.dev/signing/recipient-1");
    expect(upsert).toHaveBeenCalled();
  });

  it("throws when Firma template id is missing from step settings", async () => {
    await expect(
      ensureFirmaSigningSession({
        supabase: { from: vi.fn() } as never,
        tenantId: "tenant-1",
        workerId: "worker-1",
        applicantEmail: "applicant@example.com",
        applicantFirstName: "Jane",
        step: {
          id: "step-1",
          step_key: "employee_agreement",
          title: "Employee Agreement",
          description: null,
          step_type: "authorizations",
          sort_order: 10,
          is_required: true,
          is_enabled: true,
          metadata: { workflow_settings: DEFAULT_STEP_SETTINGS },
        },
      })
    ).rejects.toBeInstanceOf(FirmaOnboardingSigningError);
  });

  it("maps Firma workspace mismatch errors to a publish-again message", () => {
    const mapped = mapFirmaSigningCreateError(
      new FirmaOnboardingSigningError("ignored", "CREATE_FAILED")
    );
    expect(mapped.code).toBe("CREATE_FAILED");

    const workspace = mapFirmaSigningCreateError(
      Object.assign(new Error("Template does not belong to this workspace"), {
        name: "FirmaError",
      })
    );
    expect(workspace.code).toBe("TEMPLATE_WORKSPACE_MISMATCH");
    expect(workspace.message).toContain("Template Builder");
  });
});

describe("zoho separation", () => {
  it("does not route Firma-enabled steps to the Zoho authorizations page", () => {
    const route = routeForApplicantStep({
      step_key: "welcome_packet",
      step_type: "authorizations",
      metadata: {
        workflow_step_id: "welcome-packet-esign",
        workflow_settings: {
          ...DEFAULT_STEP_SETTINGS,
          firmaRecruiterTemplateId: "recruiter-template-1",
        },
      },
    });

    expect(route).toContain("/application/firma-sign");
    expect(route).not.toContain("/application/authorizations-documents");
    expect(route).not.toContain("zoho");
  });
});
