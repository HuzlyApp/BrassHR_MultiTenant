// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Page from "./page";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), fetch: vi.fn(), id: "71771234-af06-4934-a826-62688c397dd8" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: mocks.id }), useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/admin/staff-detail-fetch-cache", () => ({ fetchStaffDetailJson: (...args: unknown[]) => mocks.fetch(...args) }));
beforeEach(() => { mocks.replace.mockReset(); mocks.fetch.mockReset(); mocks.id = "71771234-af06-4934-a826-62688c397dd8"; });
describe("application detail links", () => {
  it("resolves the candidate through the existing authenticated API", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, payload: { application: { worker_id: "c334da07-77a3-4e00-9dd3-48d50ebb7d50" } } });
    render(<Page />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("/new/applications/c334da07-77a3-4e00-9dd3-48d50ebb7d50?applicationId=")));
    expect(mocks.fetch).toHaveBeenCalledWith(`/api/admin/job-applications/${mocks.id}`, { ttlMs: 0, bust: true });
  });
  it("shows an explicit error for an inaccessible application without redirecting", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 404, payload: {} });
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("selected company");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("rejects malformed application links before requesting data", async () => {
    mocks.id = "invalid";
    render(<Page />);
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
