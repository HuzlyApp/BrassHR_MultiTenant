// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AssessmentSettingsPanel from "./AssessmentSettingsPanel";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => defaultTenantBranding() }));
vi.mock("@/app/components/OnboardingStepper", () => ({ default: () => null }));
describe("assessment applicant preview", () => {
  it("opens the actual applicant preview and closes it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ canManage: true, settings: { draft: createDefaultSkillAssessmentCatalog() }, professions: [] }) }));
    render(<AssessmentSettingsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Preview Applicant Experience" }));
    expect(screen.getByRole("button", { name: "Close preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("button", { name: "Close preview" })).toBeNull();
  });
});
