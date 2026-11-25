// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DashboardOverviewClient from "./DashboardOverviewClient";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the dated schedule count without presenting a failed count as zero", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    greeting: "Hello", userName: "Carl", selectedDate: "2026-11-26",
    selectedDateLabel: "Thursday, November 26", scheduledShiftCount: 5,
  })));
  const { unmount } = render(<DashboardOverviewClient />);
  expect(await screen.findByText("5 scheduled shifts · Thursday, November 26")).toBeInTheDocument();
  unmount();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    greeting: "Hello", userName: "Carl", selectedDate: "2026-11-26",
    selectedDateLabel: "Thursday, November 26", scheduledShiftCount: null,
  })));
  render(<DashboardOverviewClient />);
  await screen.findByText("Hello, Carl!");
  expect(screen.queryByText(/scheduled shifts ·/)).not.toBeInTheDocument();
});
