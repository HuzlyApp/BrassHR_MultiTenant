// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportCenterClient from "./ReportCenterClient";

describe("ReportCenterClient", () => {
  it("shows only live reports until planned reports are explicitly requested", () => {
    render(<ReportCenterClient />);
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.getByRole("link", { name: /Team Productivity KPI/ })).toHaveAttribute("href", "/admin_recruiter/reports/team-productivity");
    fireEvent.click(screen.getByRole("checkbox", { name: "Include planned reports" }));
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
  });
  it("renders Report Center heading and category navigation", () => {
    render(<ReportCenterClient />);
    expect(screen.getByText("Report Center")).toBeTruthy();
    expect(screen.getByText("All Reports")).toBeTruthy();
    expect(screen.getByText("Team Productivity KPI")).toBeTruthy();
  });
});

