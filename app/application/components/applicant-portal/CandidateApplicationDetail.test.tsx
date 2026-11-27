// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const authHeaders = vi.fn(async () => ({ Authorization: "Bearer test" }));
vi.mock("./ApplicantPortalProvider", () => ({
  useApplicantPortal: () => ({ sessionReady: true, authHeaders }),
}));
import { CandidateApplicationDetail } from "./CandidateApplicationDetail";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
    ok: true,
    json: async () => options?.method === "POST" ? { resumeId: "new-resume" } : {
      applications: [{ id: "app-1", jobTitle: "Registered Nurse", companyName: "Clinic", status: "interviewing", statusName: "Interview Scheduled", statusNote: "Interview booked", resume: { id: "old-resume", fileName: "old.pdf" } }],
      resumes: [{ id: "saved-1", originalFileName: "saved.pdf", parsingStatus: "completed" }],
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<CandidateApplicationDetail applicationId="app-1" tenant="clinic" />);
  return { fetchMock, ...view };
}

it("shows the current stage and imports a saved resume for only the selected application", async () => {
  const { fetchMock } = setup();
  await screen.findByText("Registered Nurse");
  expect(screen.getByText("Interview Scheduled")).toBeInTheDocument();
  expect(screen.getByText("Interview booked")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to applications" }).getAttribute("href")).toContain("tenant=clinic");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "saved-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Update job resume" }));
  await screen.findByRole("status");
  const [url, options] = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(url).toBe("/api/applicant-portal/applications/app-1/resume");
  expect((options?.body as FormData).get("resumeId")).toBe("saved-1");
  expect((options?.body as FormData).has("file")).toBe(false);
});

it("uploads the replacement to the selected job and resets the file control after saving", async () => {
  const { fetchMock } = setup();
  await screen.findByText("Registered Nurse");
  const input = screen.getByLabelText("Upload a replacement resume") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["resume"], "replacement.pdf", { type: "application/pdf" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Update job resume" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Resume updated for this application."));
  const [, options] = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect((options?.body as FormData).get("file")).toBeInstanceOf(File);
  expect((options?.body as FormData).has("resumeId")).toBe(false);
  expect(screen.getByRole("button", { name: "Update job resume" })).toBeDisabled();
  expect(input.value).toBe("");
});
