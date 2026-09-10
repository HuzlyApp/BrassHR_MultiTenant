import { describe, expect, it, vi, afterEach } from "vitest";
import {
  absolutePublicJobShareUrl,
  buildPublicJobPostingJsonLd,
  buildPublicJobSharePath,
  copyPublicJobShareUrl,
  publicJobPlatformShareUrl,
  publicJobShareDescription,
  shareOrCopyPublicJobUrl,
} from "@/lib/jobs/public-job-share";

describe("public job share path", () => {
  it("builds the crawlable public job posting URL", () => {
    expect(buildPublicJobSharePath("ZipStaff", " rn-1 ")).toBe(
      "/jobs/rn-1?tenant=zipstaff"
    );
  });

  it("rejects missing tenant or token", () => {
    expect(buildPublicJobSharePath("", "rn-1")).toBeNull();
    expect(buildPublicJobSharePath("zipstaff", "null")).toBeNull();
    expect(buildPublicJobSharePath("zipstaff", "")).toBeNull();
  });

  it("resolves an absolute share URL from the current origin", () => {
    expect(
      absolutePublicJobShareUrl("/jobs/rn-1?tenant=zipstaff", "https://zipstaff.brasshr.com")
    ).toBe("https://zipstaff.brasshr.com/jobs/rn-1?tenant=zipstaff");
  });
});

describe("public job share description and platforms", () => {
  it("strips HTML and truncates for Open Graph", () => {
    const description = publicJobShareDescription(
      "<p>About the Job</p><p>Lead patient care across a busy ICU with nights and weekends.</p>",
      40
    );
    expect(description).not.toMatch(/<|>/);
    expect(description.endsWith("…")).toBe(true);
    expect(description.length).toBeLessThanOrEqual(41);
  });

  it("builds LinkedIn, Facebook, X, and email share URLs", () => {
    const url = "https://zipstaff.brasshr.com/jobs/rn-1?tenant=zipstaff";
    expect(publicJobPlatformShareUrl("linkedin", { url, title: "Travel RN" })).toContain(
      "linkedin.com/sharing/share-offsite/?url="
    );
    expect(publicJobPlatformShareUrl("facebook", { url, title: "Travel RN" })).toContain(
      "facebook.com/sharer/sharer.php?u="
    );
    expect(publicJobPlatformShareUrl("x", { url, title: "Travel RN", companyName: "ZipStaff" })).toContain(
      "twitter.com/intent/tweet"
    );
    expect(publicJobPlatformShareUrl("email", { url, title: "Travel RN" })).toMatch(/^mailto:/);
  });
});

describe("shareOrCopyPublicJobUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies the public job URL when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(
      shareOrCopyPublicJobUrl({
        url: "https://zipstaff.brasshr.com/jobs/rn-1?tenant=zipstaff",
        title: "Travel RN",
      })
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "https://zipstaff.brasshr.com/jobs/rn-1?tenant=zipstaff"
    );
  });

  it("copies from the dedicated copy helper", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(
      copyPublicJobShareUrl("https://zipstaff.brasshr.com/jobs/rn-1?tenant=zipstaff")
    ).resolves.toBe(true);
  });
});

describe("JobPosting JSON-LD", () => {
  it("includes hiring organization, location, and salary for job platforms", () => {
    const jsonLd = buildPublicJobPostingJsonLd({
      url: "https://zipstaff.brasshr.com/jobs/rn-1?tenant=zipstaff",
      title: "Travel RN",
      descriptionHtml: "<p>Lead patient care.</p>",
      companyName: "ZipStaff",
      location: "Dallas, TX 75201",
      locationType: "On-site",
      employmentType: "W2",
      datePosted: "2026-08-01T00:00:00.000Z",
      validThrough: "2026-12-31",
      payRateMin: 45,
      payRateMax: 55,
      payRatePeriod: "Hourly",
      currency: "USD",
    });
    expect(jsonLd["@type"]).toBe("JobPosting");
    expect(jsonLd.employmentType).toBe("FULL_TIME");
    expect(jsonLd.hiringOrganization).toMatchObject({ name: "ZipStaff" });
    expect(jsonLd.jobLocation).toMatchObject({
      address: { addressLocality: "Dallas", addressRegion: "TX", postalCode: "75201" },
    });
    expect(jsonLd.baseSalary).toMatchObject({
      currency: "USD",
      value: { minValue: 45, maxValue: 55, unitText: "HOUR" },
    });
  });

  it("marks remote jobs as TELECOMMUTE", () => {
    const jsonLd = buildPublicJobPostingJsonLd({
      url: "https://example.com/jobs/a?tenant=acme",
      title: "Remote RN",
      descriptionHtml: "",
      companyName: "Acme",
      locationType: "Remote",
    });
    expect(jsonLd.jobLocationType).toBe("TELECOMMUTE");
  });
});
