// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SchedulePageClient from "./SchedulePageClient";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), router: { replace: vi.fn(), push: vi.fn() }, params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/admin_recruiter/calendar/shifts", useSearchParams: () => mocks.params }));
vi.mock("@/app/admin_recruiter/components/DashboardPageLoader", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/settings/SettingsSelect", () => ({ default: (props: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; "aria-label"?: string }) => <select aria-label={props["aria-label"]} value={props.value} onChange={e => props.onChange(e.target.value)}>{props.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));
beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("who-is-off") ? { records: [] } : url.includes("/facilities") ? { facilities: [] } : url.includes("/departments") ? { departments: [] } : { employees: [{ id: "employee-a", name: "Test Worker", jobRole: "Nurse" }], shifts: [], meta: {} } }));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("schedule form feedback", () => {
  it("shows schedule totals, one work legend, and inline empty-form validation", async () => {
    render(<SchedulePageClient />);
    expect(await screen.findByRole("status")).toHaveTextContent("0 shifts in this range · 1 employees");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getAllByText("Work Shift")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Post a Shift" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Shift" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/title.*required/i);
    expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });
});
