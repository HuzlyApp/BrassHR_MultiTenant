// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandidateProfileApplicationsTab } from "./CandidateProfileApplicationsTab";
import type { CandidateProfileApplication } from "@/lib/admin/candidate-profile-view";
const application: CandidateProfileApplication = { id: "application-a", jobRequisitionId: "job-a", jobTitle: "Nurse position", companyName: "Hospital", clientName: "Clinic", facilityName: "Unit A", workType: "W2", location: "Austin, TX", billRate: null, agreedPayRate: null, jobStatus: "open", appliedAt: "2026-11-20", status: "applied", statusName: "New Applicant", statusColor: null, statusNote: null, matchScore: null, matchCategory: null, matchStatus: null, matchFitLabel: null, resume: null };
describe("candidate applications", () => {
  it("renders an existing application with its job-specific review link", () => {
    render(<CandidateProfileApplicationsTab applications={[application]} onScheduleInterview={vi.fn()} />);
    const link = screen.getByRole("link", { name: "Nurse position" });
    expect(link.getAttribute("href")).toContain("application-a");
    expect(link.getAttribute("href")).toContain("jobId=job-a");
    expect(screen.queryByText("This candidate has not applied to any jobs yet.")).not.toBeInTheDocument();
  });
});
