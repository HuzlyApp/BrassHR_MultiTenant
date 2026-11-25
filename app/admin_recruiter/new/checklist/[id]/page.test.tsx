// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "candidate-a" }), useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("../../../components/DetailedCandidateHeader", () => ({ default: ({ name }: { name: string }) => <h1>{name}</h1> }));
vi.mock("../../../components/DetailedTabs", () => ({ default: () => null }));
vi.mock("../../../components/AddCallLogModal", () => ({ default: () => null }));
import ChecklistPage from "./page";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("direct candidate checklist", () => {
  it("loads the checklist without redirecting and preserves read-only completion permissions", async () => {
    const fetch = vi.fn(async () => Response.json({
      worker: { id: "candidate-a", first_name: "Jordan", last_name: "Lee", job_role: "RN" },
      meta: { progressPercent: 0, daysInStage: 1 },
      tracker: { labels: [], done: [] },
      permissions: { canManualCompletePipeline: false },
      sections: [
        { id: "application", title: "Application", rows: [] },
        { id: "compliance", title: "Compliance", rows: [{ id: "intake", title: "Intake", state: "pending" }] },
      ],
    }));
    vi.stubGlobal("fetch", fetch);
    render(<ChecklistPage />);
    expect(await screen.findByRole("heading", { name: "Jordan Lee" })).toBeInTheDocument();
    expect(screen.getByText("Progress Checklist Tracker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Intake complete" })).toBeDisabled();
    expect(fetch).toHaveBeenCalledWith("/api/admin/worker-checklist?workerId=candidate-a", expect.any(Object));
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
