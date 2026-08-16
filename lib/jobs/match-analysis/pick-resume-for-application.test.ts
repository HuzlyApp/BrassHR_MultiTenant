import { describe, expect, it } from "vitest";
import { pickResumeForApplication } from "./pick-resume-for-application";

describe("pickResumeForApplication", () => {
  it("returns only the résumé bound to the requested application", () => {
    const rows = [
      { id: "r2", job_application_id: "app-a2", worker_id: "w1" },
      { id: "r1", job_application_id: "app-a1", worker_id: "w1" },
    ];
    expect(pickResumeForApplication(rows, "app-a1")?.id).toBe("r1");
    expect(pickResumeForApplication(rows, "app-a2")?.id).toBe("r2");
  });

  it("does not fall back to another application's résumé for the same worker", () => {
    const rows = [{ id: "r2", job_application_id: "app-a2", worker_id: "w1" }];
    expect(pickResumeForApplication(rows, "app-a1")).toBeNull();
  });
});
