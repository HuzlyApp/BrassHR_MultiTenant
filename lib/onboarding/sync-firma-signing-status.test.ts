import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";
import {
  shouldCompleteOnboardingStepFromFirmaStatus,
  syncFirmaSigningSessionStatus,
} from "@/lib/onboarding/firma-onboarding-signing";

const workspaceId = "workspace-1";

vi.mock("@/lib/firma/client", () => ({
  isFirmaConfigured: () => true,
  getFirmaSigningRequest: vi.fn(),
  getFirmaSigningRequestUsers: vi.fn(),
  resolveApplicantSigningRecipient: (
    detail: { recipients?: Array<{ id: string; email: string; status?: string }> },
    email: string
  ) => detail.recipients?.find((r) => r.email === email) ?? null,
  resolveFirmaSigningIframeUrl: () => null,
}));

vi.mock("@/lib/firma/resolve-tenant-workspace", () => ({
  resolveTenantFirmaWorkspaceId: vi.fn(async () => workspaceId),
  isStoredFirmaWorkspaceMismatch: () => false,
}));

import { getFirmaSigningRequest } from "@/lib/firma/client";

const firmaStep = {
  id: "step-1",
  step_key: "document_upload",
  title: "Document Upload",
  description: null,
  step_type: "document_upload" as const,
  sort_order: 1,
  is_required: true,
  is_enabled: true,
  metadata: {
    workflow_settings: {
      ...DEFAULT_STEP_SETTINGS,
      firmaRecruiterTemplateId: "recruiter-template-1",
    },
  },
};

const existingSession = {
  id: "session-1",
  tenant_id: "tenant-1",
  worker_id: "worker-1",
  onboarding_step_id: "step-1",
  recruiter_template_id: "recruiter-template-1",
  firma_template_id: "firma-template-1",
  firma_workspace_id: workspaceId,
  signing_request_id: "signing-request-1",
  signing_request_user_id: "recipient-1",
  firma_status: "sent",
  iframe_url: "https://app.firma.dev/signing/recipient-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function buildSupabase(firmaStatus: string) {
  return {
    from: vi.fn((table: string) => {
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { firma_workspace_id: workspaceId },
                error: null,
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
                maybeSingle: async () => ({ data: existingSession, error: null }),
              }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: { ...existingSession, firma_status: firmaStatus },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("syncFirmaSigningSessionStatus", () => {
  beforeEach(() => {
    vi.mocked(getFirmaSigningRequest).mockReset();
  });

  it("syncs completed Firma status without rejecting the session as stale", async () => {
    vi.mocked(getFirmaSigningRequest).mockResolvedValue({
      id: "signing-request-1",
      status: { sent: true, finished: true },
      recipients: [
        {
          id: "recipient-1",
          email: "applicant@example.com",
          finished_date: "2026-06-30T12:00:00.000Z",
        },
      ],
    } as never);

    const session = await syncFirmaSigningSessionStatus({
      supabase: buildSupabase("completed") as never,
      tenantId: "tenant-1",
      workerId: "worker-1",
      applicantEmail: "applicant@example.com",
      applicantFirstName: "Jane",
      step: firmaStep,
      signingRequestId: "signing-request-1",
    });

    expect(session.firma_status).toBe("completed");
    expect(shouldCompleteOnboardingStepFromFirmaStatus(session.firma_status)).toBe(true);
  });
});
