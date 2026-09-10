import { describe, expect, it } from "vitest";
import {
  formatJobListPayRateParts,
  formatJobListPayRateText,
  type JobListRow,
} from "@/app/admin_recruiter/jobs/render-job-list-cell";

function job(partial: Partial<JobListRow>): JobListRow {
  return {
    id: "job-1",
    internal_requisition_number: null,
    public_title: "RN",
    public_job_token: null,
    profession_id: null,
    specialty_id: null,
    employment_type: null,
    source_type: null,
    placement_type: null,
    msp_name: null,
    msp_client: null,
    source_job_title: null,
    status: "open",
    created_at: "2026-01-01",
    published_at: null,
    location: null,
    facility: null,
    facility_name: null,
    application_deadline: null,
    professions: null,
    specialties: null,
    onboarding_flows: null,
    job_applications: null,
    ...partial,
  };
}

describe("formatJobListPayRateParts", () => {
  it("shows a range when show_pay_by is Range and min/max differ", () => {
    const parts = formatJobListPayRateParts(
      job({
        pay_rate_min: 1000,
        pay_rate_max: 1500,
        pay_rate: 1000,
        pay_rate_period: "Monthly",
        show_pay_by: "Range",
      })
    );
    expect(parts).toEqual({ amount: "$1000 - $1500", period: "month" });
    expect(formatJobListPayRateText(job({
      pay_rate_min: 1000,
      pay_rate_max: 1500,
      pay_rate: 1000,
      pay_rate_period: "Monthly",
      show_pay_by: "Range",
    }))).toBe("$1000 - $1500 / month");
  });

  it("shows a range when min/max differ even if suggested pay_rate is set", () => {
    const parts = formatJobListPayRateParts(
      job({
        pay_rate_min: 45,
        pay_rate_max: 60,
        pay_rate: 45,
        pay_rate_period: "Hourly",
      })
    );
    expect(parts).toEqual({ amount: "$45 - $60", period: "hour" });
  });

  it("shows a fixed amount for Exact amount even when max is present", () => {
    const parts = formatJobListPayRateParts(
      job({
        pay_rate_min: 1200,
        pay_rate_max: 1500,
        pay_rate: 1200,
        pay_rate_period: "Monthly",
        show_pay_by: "Exact amount",
      })
    );
    expect(parts).toEqual({ amount: "$1200", period: "month" });
  });

  it("shows a fixed amount when only min is set", () => {
    const parts = formatJobListPayRateParts(
      job({
        pay_rate_min: 123,
        pay_rate_max: null,
        pay_rate: 123,
        pay_rate_period: "Weekly",
        show_pay_by: "Exact amount",
      })
    );
    expect(parts).toEqual({ amount: "$123", period: "week" });
  });
});
