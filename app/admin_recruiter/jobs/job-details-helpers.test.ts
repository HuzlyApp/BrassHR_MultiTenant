import { describe, expect, it } from "vitest";
import { formatJobDetailsPay, formatJobDetailsPostedDate, type JobDetailsRow } from "./job-details-helpers";
const job = (fields: Partial<JobDetailsRow>) => ({ ...fields }) as JobDetailsRow;
describe("job summary", () => {
  it.each([["hourly", "hour"], ["per hour", "hour"], ["weekly", "week"], ["annually", "year"]])("uses correct wording for %s", (period, label) => {
    expect(formatJobDetailsPay(job({ pay_rate: 25, pay_rate_period: period }))).toBe(`$25 per ${label}`);
  });
  it("preserves ranges and suggested rates", () => {
    expect(formatJobDetailsPay(job({ pay_rate_min: 25, pay_rate_max: 30, rate_unit: "hourly" }))).toBe("$25 - $30 per hour");
    expect(formatJobDetailsPay(job({ suggested_pay_rate: 45, rate_unit: "hourly" }))).toBe("$45 per hour");
  });
  it("does not use the creation date as a publication date", () => {
    expect(formatJobDetailsPostedDate(job({ status: "draft", created_at: "2026-11-01", published_at: "2026-11-02" }))).toBe("Not posted");
    expect(formatJobDetailsPostedDate(job({ status: "open", created_at: "2026-11-01" }))).toBe("Not posted");
    expect(formatJobDetailsPostedDate(job({ status: "open", published_at: "2026-11-02T12:00:00Z" }))).toContain("November 2, 2026");
  });
});
