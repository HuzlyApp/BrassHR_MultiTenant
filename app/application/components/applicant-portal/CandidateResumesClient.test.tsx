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

it("blocks a duplicate filename and clears the alert when changing files or reopening upload", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ resumes: [{ id: "existing", originalFileName: "Resume.PDF", jobApplicationId: null }], appliedJobs: [], applications: [] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const { container } = render(<CandidateResumesClient />);
  await screen.findByText("Resume.PDF");
  fireEvent.click(screen.getByRole("button", { name: "Upload Resume" }));
  fireEvent.change(container.querySelectorAll('input[type="file"]')[1], {
    target: { files: [new File(["different contents"], "resume.pdf", { type: "application/pdf" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("rename the file"))).toBe(true);
  expect(fetchMock.mock.calls).toHaveLength(2);

  fireEvent.change(container.querySelectorAll('input[type="file"]')[1], {
    target: { files: [new File(["new contents"], "renamed.pdf", { type: "application/pdf" })] },
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  fireEvent.change(container.querySelectorAll('input[type="file"]')[1], {
    target: { files: [new File(["duplicate"], "resume.pdf", { type: "application/pdf" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  fireEvent.change(screen.getByPlaceholderText("Resume Title"), { target: { value: "Old attempt" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload Resume" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove file" })).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Resume Title")).toHaveValue("");
});
