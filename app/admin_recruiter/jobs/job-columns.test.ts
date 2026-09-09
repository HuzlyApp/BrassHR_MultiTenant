import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOB_COLUMNS,
  visibleJobColumnsForTab,
} from "@/app/admin_recruiter/jobs/job-columns";

describe("visibleJobColumnsForTab", () => {
  it("hides MSP/Client on Internal even when saved", () => {
    const saved = [...DEFAULT_JOB_COLUMNS];
    expect(visibleJobColumnsForTab(saved, "internal")).not.toContain("contractGroup");
  });

  it("defaults MSP/Client on MSP after Location when missing", () => {
    const withoutClient = DEFAULT_JOB_COLUMNS.filter((id) => id !== "contractGroup");
    const cols = visibleJobColumnsForTab(withoutClient, "msp");
    expect(cols).toContain("contractGroup");
    expect(cols.indexOf("contractGroup")).toBe(cols.indexOf("location") + 1);
  });

  it("defaults MSP/Client on All after Location", () => {
    const cols = visibleJobColumnsForTab(DEFAULT_JOB_COLUMNS, "all");
    expect(cols).toContain("contractGroup");
    expect(cols.indexOf("contractGroup")).toBe(cols.indexOf("location") + 1);
  });

  it("defaults MSP/Client on Hot after Location when missing", () => {
    const withoutClient = DEFAULT_JOB_COLUMNS.filter((id) => id !== "contractGroup");
    const cols = visibleJobColumnsForTab(withoutClient, "hot");
    expect(cols).toContain("contractGroup");
    expect(cols.indexOf("contractGroup")).toBe(cols.indexOf("location") + 1);
  });

  it("keeps saved MSP/Client position on MSP", () => {
    const saved: typeof DEFAULT_JOB_COLUMNS = [
      "jobTitle",
      "contractGroup",
      "location",
      "candidates",
      "jobStatus",
      "actions",
    ];
    expect(visibleJobColumnsForTab(saved, "msp")).toEqual(saved);
  });

  it("does not include Assignee in default columns", () => {
    expect(DEFAULT_JOB_COLUMNS).not.toContain("assignee");
    expect(visibleJobColumnsForTab(DEFAULT_JOB_COLUMNS, "all")).not.toContain("assignee");
  });
});
