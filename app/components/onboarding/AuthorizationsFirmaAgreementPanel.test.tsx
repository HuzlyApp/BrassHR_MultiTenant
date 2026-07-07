// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthorizationsFirmaAgreementPanel } from "@/app/components/onboarding/AuthorizationsFirmaAgreementPanel";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

const firmaStep: TenantOnboardingStep = {
  id: "step-agreement",
  step_key: "agreement_signature",
  step_type: "authorizations",
  title: "Agreement",
  description: null,
  sort_order: 50,
  is_required: true,
  is_enabled: true,
  metadata: {
    workflow_settings: {
      ...DEFAULT_STEP_SETTINGS,
      firmaRecruiterTemplateId: "firma-template-1",
    },
  },
};

describe("AuthorizationsFirmaAgreementPanel email validation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("allows signing when a valid saved email is provided", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/onboarding/firma-sign/status")) {
        return new Response(JSON.stringify({}), { status: 404 });
      }
      if (url.includes("/api/onboarding/firma-sign/session")) {
        return new Response(
          JSON.stringify({
            session: {
              signing_request_id: "signing-request-1",
              iframe_url: "https://app.firma.dev/signing/recipient-1",
              firma_status: "sent",
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    render(
      <AuthorizationsFirmaAgreementPanel
        applicantId="applicant-1"
        step={firmaStep}
        tenantSlug="braas-hr"
        signerEmail="jane@example.com"
        signerEmailLoading={false}
        agreed
      />
    );

    expect(
      screen.queryByText(/Enter a valid email on the first onboarding step/i)
    ).not.toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Click and Sign/i });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/onboarding/firma-sign/session"),
        expect.any(Object)
      );
    });
  });

  it("does not show a false missing-email error while email is still loading", () => {
    render(
      <AuthorizationsFirmaAgreementPanel
        applicantId="applicant-1"
        step={firmaStep}
        signerEmail=""
        signerEmailLoading
        agreed
      />
    );

    expect(
      screen.queryByText(/Enter a valid email on the first onboarding step/i)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Checking email/i })).toBeDisabled();
  });

  it("shows missing-email guidance only after resolution fails", () => {
    render(
      <AuthorizationsFirmaAgreementPanel
        applicantId="applicant-1"
        step={firmaStep}
        signerEmail=""
        signerEmailLoading={false}
        agreed
      />
    );

    expect(
      screen.getByText(/Enter a valid email on the first onboarding step/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Click and Sign/i })).toBeDisabled();
  });

  it("accepts deliverable email from field alias normalization", () => {
    render(
      <AuthorizationsFirmaAgreementPanel
        applicantId="applicant-1"
        step={firmaStep}
        signerEmail="  Worker@Example.com "
        signerEmailLoading={false}
        agreed
      />
    );

    expect(
      screen.queryByText(/Enter a valid email on the first onboarding step/i)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Click and Sign/i })).not.toBeDisabled();
  });
});
