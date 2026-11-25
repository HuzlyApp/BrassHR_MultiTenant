// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "candidate-a" }), useRouter: () => mocks.router }));
vi.mock("../../../components/DetailedTabs", () => ({ default: () => null }));
vi.mock("../../../components/FinalApprovalPanel", () => ({ default: () => <button>Approve worker</button> }));
describe("closed candidate final approval", () => {
  it.each(["closed", "rejected", "disapproved", "archived", "withdrawn"])("explains %s without showing approval actions", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ worker: { status, first_name: "QA" } }) })));
    render(<Page />);
    await screen.findByText("This application is closed");
    expect(screen.queryByText("Approve worker")).toBeNull();
    expect(screen.getByRole("link", { name: "Back to applicant profile" })).toHaveAttribute("href", "/admin_recruiter/new/profile/candidate-a");
  });
});
