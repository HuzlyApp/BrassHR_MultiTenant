// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NotificationsSettingsPanel from "./NotificationsSettingsPanel";
import DepartmentsPanel from "./DepartmentsPanel";
import { NOTIFICATION_SETTINGS_STORAGE_KEY } from "@/lib/notifications/settings-catalog";
const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mocks }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
describe("notification validation", () => {
  it("rejects equal quiet-hour boundaries without saving", async () => {
    render(<NotificationsSettingsPanel />);
    fireEvent.click(await screen.findByRole("tab", { name: /Push Notifications/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Enable quiet hours" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.error).toHaveBeenCalledWith("Quiet hours must have different start and end times.");
    expect(localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY)).toBeNull();
  });
  it("allows overnight quiet hours", async () => {
    render(<NotificationsSettingsPanel />);
    fireEvent.click(await screen.findByRole("tab", { name: /Push Notifications/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Enable quiet hours" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Notification preferences saved"));
    expect(JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY)!)).toMatchObject({ quietHoursEnabled: true, quietHoursFrom: "22:00", quietHoursTo: "07:00" });
  });
});
describe("department deletion", () => {
  it.each([false, true])("only deletes after confirmation = %s", async (confirmed) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ departments: [{ id: "dept", name: "Nursing", isActive: true, jobCount: 0, candidateCount: 0 }] }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(confirmed));
    render(<DepartmentsPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Nursing" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(window.confirm).toHaveBeenCalledWith('Delete department "Nursing"? This cannot be undone.');
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(confirmed ? 1 : 0));
  });
});
