/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin_recruiter/reports/team-productivity",
  useSearchParams: () => new URLSearchParams("tab=overview&preset=last_7_days"),
}));

import TeamProductivityClient from "./TeamProductivityClient";

describe("TeamProductivityClient", () => {
  beforeEach(() => {
    replace.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          generatedAt: new Date().toISOString(),
          dataFreshness: { lastActivityAt: null, lastSessionHeartbeatAt: null, note: "" },
          disclosure: "Engaged session time measures interaction with this application.",
          period: {
            preset: "last_7_days",
            label: "Last 7 days",
            start: "2026-10-28T00:00:00.000Z",
            end: "2026-11-04T23:59:59.999Z",
            previousStart: "2026-10-21T00:00:00.000Z",
            previousEnd: "2026-10-27T23:59:59.999Z",
          },
          filtersApplied: {},
          tabs: [
            { id: "overview", label: "Overview", available: true },
            { id: "employees", label: "Employee Performance", available: true },
            { id: "sessions", label: "Activity & Sessions", available: true },
            { id: "hr", label: "HR Analytics", available: false },
          ],
          overview: {
            cards: [
              {
                key: "total_employees",
                label: "Total employees",
                value: 3,
                display: "3",
                previous: null,
                changePct: null,
                direction: "na",
                availability: "available",
                explanation: "Staff in scope",
              },
            ],
            activityTrend: [{ date: "2026-11-04", label: "Nov 4", value: 0 }],
            engagedTrend: [{ date: "2026-11-04", label: "Nov 4", value: null }],
            departmentBars: [{ dept: "Recruiting", value: null, available: false }],
          },
          departments: [],
          employees: [
            {
              employeeId: "u1",
              name: "Alex Recruiter",
              email: "alex@example.com",
              departmentId: null,
              departmentName: null,
              role: "recruiter",
              roleLabel: "Recruiter",
              engagedHours: null,
              loginHours: null,
              idleHours: null,
              jobsWorked: null,
              tasksDone: null,
              activityCount: null,
              targetAttainment: null,
              availability: {
                engagedHours: "missing",
                jobsWorked: "missing",
                activityCount: "missing",
              },
            },
          ],
          sessions: { activeCount: 0, history: [] },
          recruitment: {
            available: true,
            note: "ok",
            totals: {
              meaningfulActions: null,
              distinctJobsWorked: null,
              interviewsScheduled: null,
              hiresAttributed: null,
            },
          },
          hr: { available: false, note: "not ready" },
          finance: { available: false, note: "not ready" },
          scorecards: { available: false, note: "not ready" },
        }),
      })),
    );
  });

  it("opens Team Productivity KPI dashboard with overview metrics", async () => {
    render(<TeamProductivityClient />);
    expect(await screen.findByText("Team Productivity KPI")).toBeTruthy();
    expect(await screen.findByText("Total employees")).toBeTruthy();
    expect(await screen.findByText("Alex Recruiter")).toBeTruthy();
    expect(screen.getByText(/Engaged session time measures interaction/i)).toBeTruthy();
  });
});
