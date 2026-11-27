// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { easternDateString } from "@/lib/datetime/eastern";
import SchedulePageClient from "./SchedulePageClient";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), router: { replace: vi.fn(), push: vi.fn() }, params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/admin_recruiter/calendar/shifts", useSearchParams: () => mocks.params }));
vi.mock("@/app/admin_recruiter/components/DashboardPageLoader", () => ({ default: () => null }));
vi.mock("@/app/admin_recruiter/settings/SettingsSelect", () => ({ default: (props: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; "aria-label"?: string }) => <select aria-label={props["aria-label"]} value={props.value} onChange={e => props.onChange(e.target.value)}>{props.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));
beforeEach(() => {
  mocks.params = new URLSearchParams();
  mocks.router.replace.mockClear();
  mocks.fetch.mockReset().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("who-is-off") ? { records: [] } : url.includes("/facilities") ? { facilities: [] } : url.includes("/departments") ? { departments: [] } : { employees: [{ id: "employee-a", name: "Test Worker", jobRole: "Nurse" }], shifts: [], meta: {} } }));
  vi.stubGlobal("fetch", mocks.fetch);
});
describe("schedule form feedback", () => {
  it("offers day/month views, Today, date range, and collapsed employee filters", async () => {
    render(<SchedulePageClient />);
    await screen.findByRole("status");
    expect(screen.getByRole("combobox", { name: "Filter by worker" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select date range" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View more/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View more/i }));
    for (const filter of ["client", "position", "location", "status", "facility"]) expect(screen.getByRole("combobox", { name: `Filter by ${filter}` })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Calendar range view" }), { target: { value: "day" } });
    await waitFor(() => {
      const latest = mocks.fetch.mock.calls.filter(([url]) => String(url).includes("/scheduling/week?")).at(-1);
      const params = new URL(String(latest?.[0]), "https://brasshr.test").searchParams;
      expect(params.get("start")).toBe(params.get("end"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Today", exact: true }));
    await waitFor(() => {
      const latest = mocks.fetch.mock.calls.filter(([url]) => String(url).includes("/scheduling/week?")).at(-1);
      expect(new URL(String(latest?.[0]), "https://brasshr.test").searchParams.get("start")).toBe(easternDateString(new Date()));
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Calendar range view" }), { target: { value: "month" } });
    expect(screen.getByRole("combobox", { name: "Calendar range view" })).toHaveValue("month");
  });
  it("links scheduled employees to their candidate profile ID", async () => {
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("who-is-off") ? { records: [] } : url.includes("/facilities") ? { facilities: [] } : url.includes("/departments") ? { departments: [] } : {
      employees: [{ id: "employment-a", profileId: "candidate-a", name: "Test Worker", jobRole: "Nurse" }],
      shifts: [{ id: "shift-a", workerId: "employment-a", workDate: easternDateString(new Date()), startTime: "08:00", endTime: "17:00", title: "Nurse shift" }], meta: {},
    } }));
    render(<SchedulePageClient />);
    expect(await screen.findByRole("link", { name: "Test Worker", exact: true })).toHaveAttribute("href", "/admin_recruiter/workers/candidate-a/profile");
    expect(screen.getByRole("status")).toHaveTextContent("9 scheduled hours");
  });
  it("shows unassigned shifts and applies the dashboard open-only filter", async () => {
    mocks.params = new URLSearchParams("open=1");
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes("who-is-off") ? { records: [] } : url.includes("/facilities") ? { facilities: [] } : url.includes("/departments") ? { departments: [] } : {
      employees: [{ id: "employment-a", name: "Assigned Worker", jobRole: "Nurse" }], shifts: [
        { id: "open-a", workerId: "", workDate: easternDateString(new Date()), startTime: "08:00", endTime: "17:00", title: "Open coverage" },
        { id: "assigned-a", workerId: "employment-a", workDate: easternDateString(new Date()), startTime: "08:00", endTime: "17:00", title: "Assigned coverage" },
      ], meta: {},
    } }));
    render(<SchedulePageClient />);
    expect(await screen.findByText("Open coverage")).toBeInTheDocument();
    expect(screen.queryByText("Assigned coverage")).not.toBeInTheDocument();
    expect(screen.getByText("Open shifts", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 shifts in this range");
    expect(screen.getByRole("status")).toHaveTextContent("9 scheduled hours");
    expect(screen.getByRole("switch", { name: "Open shifts only" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("switch", { name: "Open shifts only" }));
    expect(mocks.router.replace).toHaveBeenCalledWith("/admin_recruiter/calendar/shifts?", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Post a Shift" }));
    expect(screen.getByRole("combobox", { name: "Select employee" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Open shift (unassigned)" })).toBeInTheDocument();
  });
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

it("starts a new shift without the employee selected in a cancelled draft", async () => {
  render(<SchedulePageClient />);
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "Post a Shift" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Select employee" }), { target: { value: "employee-a" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Post a Shift" }));
  expect(screen.getByRole("combobox", { name: "Select employee" })).toHaveValue("");
});

it("requires an explicit confirmation for an end time on the following day", async () => {
  render(<SchedulePageClient />);
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "Post a Shift" }));
  const title = screen.getByPlaceholderText("e.g. Warehouse Staff, Morning Shift");
  const form = title.closest("form")!;
  fireEvent.change(title, { target: { value: "Overnight coverage" } });
  fireEvent.change(form.querySelector('input[type="date"]')!, { target: { value: easternDateString(new Date()) } });
  fireEvent.change(form.querySelectorAll('input[type="time"]')[1], { target: { value: "07:00" } });
  const previousConfirm = window.confirm;
  const confirm = vi.fn(() => false);
  window.confirm = confirm;
  fireEvent.click(screen.getByRole("button", { name: "Create Shift" }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("overnight shift ends on the following day"));
  expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  window.confirm = previousConfirm;
});
