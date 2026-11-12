import { describe, expect, it } from "vitest";
import { canAssignWorkerTasks } from "@/lib/tasks/assigner-roles";

describe("canAssignWorkerTasks", () => {
  it("allows Manager, HR, and Admin when restriction is on", () => {
    expect(canAssignWorkerTasks("manager", true)).toBe(true);
    expect(canAssignWorkerTasks("hr", true)).toBe(true);
    expect(canAssignWorkerTasks("admin", true)).toBe(true);
  });

  it("blocks recruiter and other staff when restriction is on", () => {
    expect(canAssignWorkerTasks("client", true)).toBe(false);
    expect(canAssignWorkerTasks("recruiter", true)).toBe(false);
    expect(canAssignWorkerTasks("finance", true)).toBe(false);
  });

  it("allows any role when restriction is off", () => {
    expect(canAssignWorkerTasks("client", false)).toBe(true);
    expect(canAssignWorkerTasks("finance", false)).toBe(true);
  });
});
