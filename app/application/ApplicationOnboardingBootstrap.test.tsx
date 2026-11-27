// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ TenantBrandingProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/app/components/onboarding/OnboardingConfigProvider", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/lib/tenant/apply-branding-head", () => ({ applyBrandingHead: vi.fn() }));
vi.mock("@/lib/onboarding/ensure-applicant-auth", () => ({ ensureApplicantMatchesAuthSession: async () => ({ error: "Create an account or sign in to continue.", reason: "sign_in_required", signInHref: "/candidate-signin?tenant=zippycorp" }) }));
import ApplicationOnboardingBootstrap from "./ApplicationOnboardingBootstrap";
describe("returning anonymous applicant", () => {
 it("offers candidate sign-in and an explicit different-person restart without mounting private views", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ branding: null }) }));
  render(<ApplicationOnboardingBootstrap><p>Private applicant details</p></ApplicationOnboardingBootstrap>);
  expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/candidate-signin?tenant=zippycorp");
  expect(screen.getByRole("button", { name: "Different person? Start a new application" })).toBeInTheDocument();
  expect(screen.queryByText("Private applicant details")).not.toBeInTheDocument();
  expect(screen.queryByText(/enable Anonymous Sign-In/)).not.toBeInTheDocument();
  vi.unstubAllGlobals();
 });
});
