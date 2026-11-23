// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AddCandidateModal from "./AddCandidateModal";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({ useTenantBranding: () => defaultTenantBranding() }));
vi.mock("./ImportCandidatesModal", () => ({ default: () => null }));
vi.mock("./MatchAnalysisModelSelect", () => ({ useMatchAnalysisProvider: () => ["openai", vi.fn()] }));
vi.mock("@/app/components/BrandedSvgIcon", () => ({ default: () => null }));
vi.mock("@/app/components/BrandedUploadIcon", () => ({ default: () => null }));
vi.mock("@/lib/service-area/use-service-area-preview", () => ({ useServiceAreaPreview: () => ({ allowed: true, loading: false }) }));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  return query;
} } }));
beforeEach(() => {
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ parsed: null }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
const files = () => [new File(["resume"], "one.pdf", { type: "application/pdf" }), new File(["resume"], "two.pdf", { type: "application/pdf" })];
describe("single-resume import", () => {
  it("keeps Upload disabled when the parser supplies no required identity", async () => {
    const { container } = render(<AddCandidateModal open jobId="job-a" onClose={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [files()[0]] } });
    await screen.findByPlaceholderText("First name");
    expect(screen.getByRole("button", { name: "Upload", exact: true })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("First name is required");
  });
  it("shows parsed resume sections and the candidate's own location for review", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ parsed: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "", location: "Austin, TX", summary: "Registered nurse.", skills: ["ICU"], experience: [{ company: "Clinic", position: "RN", start_date: "2021", end_date: null, description: "Patient care" }], education: [{ institution: "University", degree: "BSN" }] } }) });
    const { container } = render(<AddCandidateModal open jobId="job-a" onClose={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [files()[0]] } });
    expect(await screen.findByText("Candidate location from resume: Austin, TX")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Parsed resume details"));
    expect(screen.getByText("Registered nurse.")).toBeVisible();
    expect(screen.getByText("Patient care")).toBeVisible();
    expect(screen.getByText(/BSN.*University/)).toBeVisible();
  });
  it("explains the specific name error blocking upload", async () => {
    const { container } = render(<AddCandidateModal open jobId="job-a" onClose={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [files()[0]] } });
    const firstName = await screen.findByPlaceholderText("First name");
    fireEvent.change(firstName, { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("Last name"), { target: { value: "Applicant2" } });
    expect(screen.getByRole("status")).toHaveTextContent("Last name cannot include numbers");
    expect(screen.getByRole("button", { name: "Upload", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload", exact: true })).toHaveAttribute("aria-describedby", "candidate-upload-blocked");
  });
  it("rejects multi-file drops without parsing the first resume", async () => {
    const { container } = render(<AddCandidateModal open onClose={vi.fn()} />);
    fireEvent.drop(container.querySelector(".border-dashed")!, { dataTransfer: { files: files() } });
    expect(screen.getByText(/Upload one resume at a time/)).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("accepts a single file and prevents multi-file picker selection", async () => {
    const { container } = render(<AddCandidateModal open onClose={vi.fn()} />);
    const input = container.querySelector('input[type="file"]')!;
    expect(input).not.toHaveAttribute("multiple");
    fireEvent.change(input, { target: { files: [files()[0]] } });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/add-candidate-from-resume/parse", expect.objectContaining({ method: "POST" })));
  });
});
