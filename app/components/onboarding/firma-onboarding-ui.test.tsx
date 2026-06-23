// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FirmaSigningIframe } from "@/app/components/onboarding/FirmaSigningIframe";
import FirmaSignPage from "@/app/application/firma-sign/page";
import { FirmaTemplateSelect } from "@/app/components/onboarding/FirmaTemplateSelect";

const { searchParamsMock } = vi.hoisted(() => ({
  searchParamsMock: vi.fn(
    () => new URLSearchParams("stepKey=employee_agreement&tenant=braas-hr")
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: searchParamsMock,
}));

vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({
  useTenantBranding: () => ({}),
}));

vi.mock("@/lib/tenant/tenant-branding", () => ({
  brandingToCssVars: () => ({}),
}));

vi.mock("@/app/components/OnboardingLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/components/OnboardingStepper", () => ({
  default: () => <div data-testid="onboarding-stepper" />,
}));

vi.mock("@/app/components/OnboardingLoader", () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

const mockNav = {
  configLoading: false,
  currentStep: {
    step_key: "employee_agreement",
    title: "Employee Agreement",
  },
  nextRoute: "/application/application-summary?stepKey=review_submit",
  prevRoute: "/application/skills-intro?stepKey=skill_assessment",
  push: vi.fn(),
  replace: vi.fn(),
  slug: "braas-hr",
  config: { steps: [] },
  enabledSteps: [],
};

vi.mock("@/lib/onboarding/use-onboarding-step-nav", () => ({
  useOnboardingStepNav: () => mockNav,
}));

vi.mock("@/lib/onboarding/ensure-applicant-worker", () => ({
  ensureApplicantWorker: vi.fn(async () => ({ ok: true, workerId: "worker-1" })),
}));

describe("FirmaSigningIframe", () => {
  it("renders the Firma signing iframe inside onboarding", () => {
    render(
      <FirmaSigningIframe iframeUrl="https://app.firma.dev/signing/recipient-1" title="Employee Agreement" />
    );

    const iframe = screen.getByTestId("firma-signing-iframe") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe("https://app.firma.dev/signing/recipient-1");
    expect(iframe.getAttribute("allow")).toContain("camera");
  });

  it("shows an inline missing-URL state instead of redirecting away", () => {
    render(<FirmaSigningIframe iframeUrl={null} />);
    expect(screen.getByTestId("firma-signing-iframe-missing")).toBeInTheDocument();
  });
});

describe("FirmaSignPage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.setItem("applicantId", "applicant-user-1");
    searchParamsMock.mockReturnValue(
      new URLSearchParams("stepKey=employee_agreement&tenant=braas-hr")
    );
    mockNav.push.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("loads a Firma signing session in draft preview without a stored applicant id", async () => {
    localStorage.removeItem("applicantId");
    searchParamsMock.mockReturnValue(
      new URLSearchParams("stepKey=employee_agreement&tenant=subdomaintest&preview=draft")
    );

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/onboarding/firma-sign/session")) {
        return new Response(
          JSON.stringify({
            session: {
              signing_request_id: "signing-request-1",
              iframe_url: "https://app.firma.dev/signing/recipient-1",
              firma_status: "sent",
              onboarding_status: "in_progress",
              step_title: "Employee Agreement",
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    render(<FirmaSignPage />);

    await waitFor(() => {
      expect(screen.getByTestId("firma-signing-iframe")).toBeInTheDocument();
    });
  });

  it("loads a Firma signing session and renders the iframe without leaving onboarding", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/onboarding/firma-sign/session")) {
        return new Response(
          JSON.stringify({
            session: {
              signing_request_id: "signing-request-1",
              iframe_url: "https://app.firma.dev/signing/recipient-1",
              firma_status: "sent",
              onboarding_status: "in_progress",
              step_title: "Employee Agreement",
            },
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    render(<FirmaSignPage />);

    await waitFor(() => {
      expect(screen.getByTestId("firma-signing-iframe")).toBeInTheDocument();
    });

    expect(screen.getByTestId("onboarding-stepper")).toBeInTheDocument();
    expect(screen.queryByText(/zoho/i)).not.toBeInTheDocument();
  });

  it("shows an error when signing request creation fails", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: "Failed to create Firma signing request", code: "CREATE_FAILED" }),
        { status: 500 }
      )
    ) as typeof fetch;

    render(<FirmaSignPage />);

    await waitFor(() => {
      expect(screen.getByTestId("firma-signing-error")).toHaveTextContent(
        "Failed to create Firma signing request"
      );
    });
    expect(screen.getByTestId("firma-signing-iframe-missing")).toBeInTheDocument();
  });

  it("shows an error for invalid signing request id", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "The Firma signing request is no longer valid",
          code: "INVALID_SESSION",
        }),
        { status: 410 }
      )
    ) as typeof fetch;

    render(<FirmaSignPage />);

    await waitFor(() => {
      expect(screen.getByTestId("firma-signing-error")).toHaveTextContent("no longer valid");
    });
  });
});

describe("FirmaTemplateSelect", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("loads published Firma templates for onboarding builder attachment", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          templates: [{ id: "recruiter-template-1", name: "Employee Agreement", firma_template_id: "firma-1" }],
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const onChange = vi.fn();
    render(<FirmaTemplateSelect value="" onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("firma-template-select-input")).toBeInTheDocument();
    });

    const select = screen.getByTestId("firma-template-select-input") as HTMLSelectElement;
    expect(Array.from(select.options).some((option) => option.text === "Employee Agreement")).toBe(true);
  });

  it("shows an error when template list fails to load", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    ) as typeof fetch;

    render(<FirmaTemplateSelect value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("firma-template-select-error")).toHaveTextContent("Unauthorized");
    });
  });
});
