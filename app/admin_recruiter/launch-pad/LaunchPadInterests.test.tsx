// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LaunchPadInterests } from "./LaunchPadInterests";
const fetchMock = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", fetchMock); });

describe("signup interest screen", () => {
  it("shows the six choices, allows multiple interests, and saves the reporting keys", async () => {
    const onComplete = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ tenantId: "tenant-a", interests: { keys: ["hr_data_reporting", "hiring_onboarding"], skipped: false, answeredAt: "2026-11-20T20:00:00Z" } }));
    render(<LaunchPadInterests tenantId="tenant-a" onComplete={onComplete} onBack={vi.fn()} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Save & Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "HR Data & Reporting" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hiring & Onboarding" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ keys: ["hr_data_reporting", "hiring_onboarding"], skipped: false });
  });
  it("saves an explicit skip and continues", async () => {
    const onComplete = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ tenantId: "tenant-a", interests: { keys: [], skipped: true, answeredAt: "2026-11-20T20:00:00Z" } }));
    render(<LaunchPadInterests tenantId="tenant-a" onComplete={onComplete} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ keys: [], skipped: true });
  });
  it("retains selections and shows save errors without continuing", async () => {
    const onComplete = vi.fn();
    fetchMock.mockResolvedValue(Response.json({ error: "Please retry" }, { status: 503 }));
    render(<LaunchPadInterests tenantId="tenant-a" onComplete={onComplete} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "AI Powered HR" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please retry");
    expect(screen.getByRole("checkbox", { name: "AI Powered HR" })).toBeChecked();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
