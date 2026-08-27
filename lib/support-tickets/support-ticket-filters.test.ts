import { describe, expect, it } from "vitest";
import { summarizeTicketSubject } from "@/lib/support-tickets/support-ticket-service";

describe("support ticket status filters", () => {
  it("summarizes subject from description when subject omitted", () => {
    expect(summarizeTicketSubject("Need help with payroll access")).toBe(
      "Need help with payroll access"
    );
  });

  it("prefers explicit subject", () => {
    expect(summarizeTicketSubject("long description", "Payroll")).toBe("Payroll");
  });
});

describe("sidebar filter semantics", () => {
  function matchesSidebarFilter(
    status: string,
    filter: "open" | "closed" | "archived"
  ): boolean {
    const normalized = status.toLowerCase();
    if (filter === "open") return !["closed", "resolved"].includes(normalized);
    if (filter === "closed") return normalized === "closed";
    return normalized === "resolved";
  }

  it("keeps Open / In Progress / Pending in open view", () => {
    expect(matchesSidebarFilter("Open", "open")).toBe(true);
    expect(matchesSidebarFilter("In Progress", "open")).toBe(true);
    expect(matchesSidebarFilter("Pending", "open")).toBe(true);
    expect(matchesSidebarFilter("Closed", "open")).toBe(false);
    expect(matchesSidebarFilter("Resolved", "open")).toBe(false);
  });

  it("maps Closed and Resolved to closed/archived views", () => {
    expect(matchesSidebarFilter("Closed", "closed")).toBe(true);
    expect(matchesSidebarFilter("Resolved", "closed")).toBe(false);
    expect(matchesSidebarFilter("Resolved", "archived")).toBe(true);
    expect(matchesSidebarFilter("Closed", "archived")).toBe(false);
  });
});
