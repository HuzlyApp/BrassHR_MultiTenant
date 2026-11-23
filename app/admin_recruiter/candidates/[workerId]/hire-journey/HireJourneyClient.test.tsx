// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import HireJourneyClient from "./HireJourneyClient";
import { invalidateStaffDetailCache, STAFF_DETAIL_TIMEOUT_MS } from "@/lib/admin/staff-detail-fetch-cache";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/admin_recruiter/components/hire-stage/HireJourneyTheme", () => ({ HireJourneyThemeProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/app/admin_recruiter/components/hire-stage/HireStageBoard", () => ({ HireStageBoard: (props: { loading: boolean; error: string | null; onRetry: () => void }) => props.loading ? <p>Loading workflow</p> : props.error ? <div role="alert">{props.error}<button onClick={props.onRetry}>Retry</button></div> : <p>Workflow loaded</p> }));
afterEach(() => { invalidateStaffDetailCache(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("hire journey stalled reads", () => {
  it("replaces a stalled spinner with retryable feedback and retries successfully", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(() => new Promise<Response>(() => {})); vi.stubGlobal("fetch", fetch);
    render(<HireJourneyClient workerId="candidate-a" embeddedPhase="pre_hire" />);
    expect(screen.getByText("Loading workflow")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(STAFF_DETAIL_TIMEOUT_MS); });
    expect(screen.getByRole("alert")).toHaveTextContent("took too long");
    expect(screen.queryByText("Loading workflow")).not.toBeInTheDocument();
    fetch.mockImplementation(async () => Response.json({ preHire: { assigned: false, steps: [] }, postHire: { assigned: false, steps: [] } }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })); });
    expect(screen.getByText("Workflow loaded")).toBeInTheDocument();
  });
});
