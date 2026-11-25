import { describe, expect, it } from "vitest";
import { employeesToCsv, type EmployeePerformanceRow } from "./team-productivity-service";

describe("same-name productivity accounts", () => {
  it("keeps distinct account IDs in CSV instead of merging names", () => {
    const rows = ["account-a", "account-b"].map((employeeId, i) => ({ employeeId, name: "Same Name", email: `person${i}@example.com`, roleLabel: i ? "HR" : "Admin" }) as EmployeePerformanceRow);
    const csv = employeesToCsv(rows);
    expect(csv.split("\n")[0]).toBe("Employee ID,Employee,Email,Department,Role,Engaged Hours,Login Hours,Idle Hours,Jobs Worked,Activity Count,Status Updates,Stage Advances,Candidate Matches,Target Attainment");
    expect(csv).toContain("account-a,Same Name,person0@example.com");
    expect(csv).toContain("account-b,Same Name,person1@example.com");
    expect(csv.split("\n")).toHaveLength(3);
  });
});
