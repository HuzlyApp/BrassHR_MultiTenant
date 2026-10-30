import { describe, expect, it } from "vitest";
import { resolvedCandidateDepartment } from "./resolve-department";

describe("resolvedCandidateDepartment", () => {
  it("uses a direct candidate department ahead of the job department", () => {
    expect(
      resolvedCandidateDepartment({
        direct_department_name: "Nursing",
        application_department: "Operations",
      })
    ).toEqual({ name: "Nursing", source: "candidate" });
  });

  it("uses the job department when the candidate has none", () => {
    expect(
      resolvedCandidateDepartment({
        direct_department_name: "  ",
        application_department: "Facilities",
      })
    ).toEqual({ name: "Facilities", source: "job" });
  });

  it("returns empty when neither side is set", () => {
    expect(resolvedCandidateDepartment({})).toEqual({ name: null, source: null });
  });
});
