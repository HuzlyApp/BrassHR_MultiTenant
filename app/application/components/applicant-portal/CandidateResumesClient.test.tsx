// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CandidateResumesClient } from "./CandidateResumesClient";

const authHeaders = vi.hoisted(() => vi.fn(async () => ({ Authorization: "Bearer test" })));
vi.mock("./ApplicantPortalProvider", () => ({
  useApplicantPortal: () => ({
    session: { applicant: { id: "worker-1" } }, sessionReady: true, authHeaders,
  }),
}));

afterEach(() => vi.unstubAllGlobals());

it("uploads a resume when the candidate has no applications", async () => {
  const fetchMock = vi.fn(async (_url: unknown, options?: RequestInit) => ({
    ok: true,
    json: async () => options?.method === "POST"
      ? { resumeId: "resume-1", resumes: [] }
      : { resumes: [], appliedJobs: [], applications: [] },
  }));
  vi.stubGlobal("fetch", fetchMock);
  const { container } = render(<CandidateResumesClient />);
  await screen.findByText("You have not uploaded a resume yet.");
  fireEvent.click(screen.getByRole("button", { name: "Upload Resume" }));
  const inputs = container.querySelectorAll('input[type="file"]');
  fireEvent.change(inputs[1], {
    target: { files: [new File(["resume contents"], "resume.pdf", { type: "application/pdf" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));

  await waitFor(() => expect(screen.getByText("New resume uploaded.")).toBeInTheDocument());
  const post = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
  expect(post?.[0]).toBe("/api/applicant-portal/resumes");
  const body = post?.[1]?.body as FormData;
  expect(body.get("file")).toBeInstanceOf(File);
  expect(body.has("jobApplicationId")).toBe(false);
});
