// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CandidateWorkflowStepModal from "./CandidateWorkflowStepModal";
import type { WorkflowStepInspection } from "@/lib/onboarding/candidate-workflow-step-inspection";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => defaultTenantBranding() }));
vi.mock("./hire-stage/HireJourneyTheme", () => ({ useHireJourneyTheme: () => null }));
vi.mock("./StageContextNotesSection", () => ({ StageContextNotesSection: () => null }));
const inspection = {
  ok: true, kind: "generic", phase: "pre_hire", documents: [], references: [],
  step: { id: "step-a", title: "Candidate task", stepType: "custom", stepKey: "custom", required: true, displayStatus: "not_started", status: "pending" },
  staffAction: { allowed: false, actions: [], variant: "default" },
  candidateReview: { canComplete: true, canVerify: false, verified: false },
} as unknown as WorkflowStepInspection;
describe("workflow completion busy feedback", () => {
  it("shows Saving while completing a step, without displaying Sending on the email button", () => {
    const fetch = vi.fn(() => new Promise(() => {})); vi.stubGlobal("fetch", fetch);
    render(<CandidateWorkflowStepModal open onOpenChange={vi.fn()} inspection={inspection} workerId="worker-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as complete" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.queryByText("Sending…")).toBeNull();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/workflow-steps/step-a"), expect.objectContaining({ method: "POST", body: expect.stringContaining('"action":"complete"') }));
  });
  it("provides preview and download actions for an uploaded document", () => {
    const documentInspection = { ...inspection, kind: "upload", documents: [{ id: "doc-a", documentName: "Nursing license", originalFileName: "license.pdf", documentType: "application/pdf", fileSize: 1200, uploadedAt: null, uploadedBy: null, verificationStatus: "uploaded", previewUrl: "https://example.com/preview-license", downloadUrl: "https://example.com/download-license", fileUnavailable: false, approvedOrRejectedAt: null, reviewedBy: null, reviewNotes: null }] } as WorkflowStepInspection;
    render(<CandidateWorkflowStepModal open onOpenChange={vi.fn()} inspection={documentInspection} workerId="worker-a" />);
    expect(screen.getByRole("link", { name: "Preview", exact: true })).toHaveAttribute("href", "https://example.com/preview-license");
    expect(screen.getByRole("link", { name: "Download", exact: true })).toHaveAttribute("href", "https://example.com/download-license");
  });

});
