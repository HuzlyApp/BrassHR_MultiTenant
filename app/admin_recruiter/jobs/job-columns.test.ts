import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOB_COLUMNS,
  visibleJobColumnsForTab,
} from "@/app/admin_recruiter/jobs/job-columns";

describe("visibleJobColumnsForTab", () => {
  it("hides End client on Internal even when saved", () => {
    const saved = [...DEFAULT_JOB_COLUMNS];
    saved.splice(2, 0, "contractGroup");
    expect(visibleJobColumnsForTab(saved, "internal")).not.toContain("contractGroup");
  });

  it("defaults End client on MSP after Location when missing", () => {
    const cols = visibleJobColumnsForTab(DEFAULT_JOB_COLUMNS, "msp");
    expect(cols).toContain("contractGroup");
    expect(cols.indexOf("contractGroup")).toBe(cols.indexOf("location") + 1);
  });

  it("keeps saved End client position on MSP", () => {
    const saved: typeof DEFAULT_JOB_COLUMNS = [
      "jobTitle",
      "contractGroup",
      "location",
      "candidates",
      "jobStatus",
      "assignee",
      "actions",
    ];
    expect(visibleJobColumnsForTab(saved, "msp")).toEqual(saved);
  });

  it("keeps Assignee (Created By) on All by default", () => {
    expect(visibleJobColumnsForTab(DEFAULT_JOB_COLUMNS, "all")).toContain("assignee");
  });

  it("does not force End client on All / Hot", () => {
    expect(visibleJobColumnsForTab(DEFAULT_JOB_COLUMNS, "all")).not.toContain(
      "contractGroup"
    );
    expect(visibleJobColumnsForTab(DEFAULT_JOB_COLUMNS, "hot")).not.toContain(
      "contractGroup"
    );
  });
});
