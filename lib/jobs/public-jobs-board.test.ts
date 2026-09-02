import { describe, expect, it } from "vitest";
import {
  buildJobsBoardHref,
  buildPublicJobsApiSearchParams,
  descriptionHasSection,
  formatPublicJobDescriptionHtml,
  formatPublicJobPay,
  formatWorkplaceType,
  hasActiveJobsBoardFilters,
  jobCardSummary,
  parseJobsBoardSearchParams,
  resolveSelectedJobToken,
  selectedJobApplyHref,
} from "@/lib/jobs/public-jobs-board";

describe("jobs board URL state", () => {
  it("parses search, filters, page, and selected job", () => {
    const parsed = parseJobsBoardSearchParams(
      new URLSearchParams(
        "tenant=zipstaff&q=RN&professionId=p1&specialtyId=s1&location=Dallas&employmentType=W2&page=2&job=token-9"
      )
    );
    expect(parsed).toMatchObject({
      q: "RN",
      professionId: "p1",
      specialtyId: "s1",
      location: "Dallas",
      employmentType: "W2",
      locationType: "",
      sort: "recent",
      page: 2,
      job: "token-9",
      panel: null,
    });
  });

  it("ignores invalid employment types and null job tokens", () => {
    const parsed = parseJobsBoardSearchParams(
      new URLSearchParams("employmentType= intern&job=undefined&page=0")
    );
    expect(parsed.employmentType).toBe("");
    expect(parsed.job).toBeNull();
    expect(parsed.page).toBe(1);
  });

  it("serializes tenant, filters, pagination, and selected job", () => {
    expect(
      buildJobsBoardHref({
        tenant: "zipstaff",
        q: "nurse",
        page: 3,
        job: "abc",
        panel: "detail",
      })
    ).toBe("/jobs?tenant=zipstaff&q=nurse&page=3&job=abc&panel=detail");
  });

  it("keeps public API queries tenant-scoped and omits the selected job", () => {
    const params = buildPublicJobsApiSearchParams({
      tenant: "ZipStaff",
      q: "ICU",
      page: 2,
    });
    expect(params.get("tenant")).toBe("zipstaff");
    expect(params.get("q")).toBe("ICU");
    expect(params.get("page")).toBe("2");
    expect(params.has("job")).toBe(false);
  });

  it("detects active filters", () => {
    expect(hasActiveJobsBoardFilters({ q: "", professionId: "", specialtyId: "", location: "", employmentType: "" })).toBe(false);
    expect(hasActiveJobsBoardFilters({ q: "RN", professionId: "", specialtyId: "", location: "", employmentType: "" })).toBe(true);
  });
});

describe("selected job resolution", () => {
  const jobs = [{ public_job_token: "a" }, { public_job_token: "b" }];

  it("selects the first visible result by default", () => {
    expect(resolveSelectedJobToken(jobs, null)).toBe("a");
  });

  it("keeps a requested job when it is still visible", () => {
    expect(resolveSelectedJobToken(jobs, "b")).toBe("b");
  });

  it("falls back to the first valid result for stale or deleted IDs", () => {
    expect(resolveSelectedJobToken(jobs, "deleted")).toBe("a");
    expect(resolveSelectedJobToken(jobs, "null")).toBe("a");
    expect(resolveSelectedJobToken([], "a")).toBeNull();
  });
});

describe("job card summary sanitization", () => {
  it("strips HTML, entities, and duplicated headings from result cards", () => {
    const summary = jobCardSummary(
      "<p>About the Job</p><p>Travel RN</p><p>Lead&nbsp;patient care in ICU.</p><script>alert(1)</script>",
      "Travel RN"
    );
    expect(summary).toBe("Lead patient care in ICU.");
    expect(summary).not.toMatch(/<|>|&nbsp;|About the Job|script/i);
  });

  it("does not copy the full description into the card summary", () => {
    const long = `<p>${"Duty ".repeat(80)}</p>`;
    const summary = jobCardSummary(long, "RN");
    expect(summary.endsWith("…")).toBe(true);
    expect(summary.length).toBeLessThan(240);
  });
});

describe("job description HTML", () => {
  it("sanitizes externally supplied markup before rendering", () => {
    const html = formatPublicJobDescriptionHtml(
      '<p onclick="alert(1)">About the Role</p><p>Lead care.</p><script>evil()</script><p><strong>Benefits</strong></p><p>401k</p>',
      true
    );
    expect(html).toContain("Lead care.");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html.toLowerCase()).not.toContain("401k");
  });

  it("preserves stored job description markup on the public board", () => {
    const html = formatPublicJobDescriptionHtml(
      '<div><strong>Systems Engineer</strong></div><div>Location: Dallas, TX (Hybrid)</div><div><strong>About the Opportunity</strong></div><div>Lead enterprise storage.</div><div><strong>What You\'ll Do</strong></div><ul><li>Manage SAN arrays.</li></ul>',
      false,
      "Systems Engineer"
    );
    expect(html).toContain("<strong>Systems Engineer</strong>");
    expect(html).toContain("Location: Dallas, TX (Hybrid)");
    expect(html).toContain("<strong>About the Opportunity</strong>");
    expect(html).toContain("Lead enterprise storage.");
    expect(html).toContain("<strong>What You'll Do</strong>");
    expect(html).toContain("<li>Manage SAN arrays.</li>");
    expect(html).not.toContain("<div");
  });

  it("strips duplicated wrapper labels such as Full job description", () => {
    const html = formatPublicJobDescriptionHtml(
      "<p>Full job description</p><p>Job Description</p><p>About the Role</p><p>Lead care.</p>",
      false,
      "Travel RN"
    );
    expect(html).toContain("Lead care.");
    expect(html).toContain("About the Role");
    expect(html.toLowerCase()).toContain("full job description");
  });

  it("detects existing section headings so details are not duplicated", () => {
    expect(descriptionHasSection("<p><strong>Responsibilities</strong></p><p>Chart</p>", "Responsibilities")).toBe(true);
    expect(descriptionHasSection("<p>Chart daily</p>", "Responsibilities")).toBe(false);
  });
});

describe("job meta formatting", () => {
  it("formats pay when a rate is available", () => {
    expect(
      formatPublicJobPay({
        pay_rate_min: 45,
        pay_rate_max: 55,
        pay_rate_period: "Hourly",
        show_pay_by: "Range",
      })
    ).toBe("$45 – $55 per hour");
  });

  it("returns workplace type when present", () => {
    expect(formatWorkplaceType("Hybrid")).toBe("Hybrid");
    expect(formatWorkplaceType("")).toBeNull();
  });

  it("builds the apply route for the selected job only", () => {
    expect(selectedJobApplyHref("zipstaff", { public_job_token: "rn-2", workflow_id: "wf-1" })).toBe(
      "/apply?tenant=zipstaff&job_token=rn-2"
    );
    expect(selectedJobApplyHref("zipstaff", { public_job_token: "rn-2", workflow_id: null })).toBeNull();
  });
});
