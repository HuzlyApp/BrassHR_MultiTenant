import { beforeEach, describe, expect, it, vi } from "vitest";

const grokParseResumeCachedMock = vi.hoisted(() => vi.fn());
const extractResumeTextFromUploadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/resume/grok-parse-resume-cached", () => ({
  grokParseResumeCached: (...args: unknown[]) => grokParseResumeCachedMock(...args),
}));

vi.mock("@/lib/jobs/match-analysis/extract-resume-text", () => ({
  extractResumeTextFromUpload: (...args: unknown[]) => extractResumeTextFromUploadMock(...args),
}));

import {
  prepareResumeCandidate,
  resolveAdminCandidateIdentity,
} from "@/lib/jobs/admin-add-candidate-from-resume";
import { JobValidationError } from "@/lib/jobs/types";
import type { NormalizedParsedResume } from "@/lib/resumeParseQuality";

const PARTIAL_PARSE: NormalizedParsedResume = {
  first_name: "Jordan",
  last_name: "Lee",
  email: "jordan.lee@clinic.org",
  phone: "(404) 555-0100",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  job_role: "RN",
};

const READABLE_RESUME = `
Jordan Lee
Registered Nurse
jordan.lee@clinic.org
(404) 555-0100

Professional summary
Registered nurse with hospital experience.

Experience
Memorial Hospital — Registered Nurse
Provided patient care, certifications, and nursing support.

Education
Bachelor of Science in Nursing
`.trim();

describe("resolveAdminCandidateIdentity", () => {
  it("prefers recruiter-entered fields over parsed values", () => {
    const identity = resolveAdminCandidateIdentity(PARTIAL_PARSE, {
      firstName: "Pat",
      lastName: "Kim",
      email: "pat.kim@clinic.org",
      phone: "4045550199",
    });

    expect(identity).toEqual({
      firstName: "Pat",
      lastName: "Kim",
      fullName: "Pat Kim",
      email: "pat.kim@clinic.org",
      phone: "4045550199",
    });
  });

  it("falls back to parsed identity when recruiter fields are empty", () => {
    const identity = resolveAdminCandidateIdentity(PARTIAL_PARSE, {});
    expect(identity.fullName).toBe("Jordan Lee");
    expect(identity.email).toBe("jordan.lee@clinic.org");
  });
});

describe("prepareResumeCandidate", () => {
  beforeEach(() => {
    grokParseResumeCachedMock.mockReset();
    extractResumeTextFromUploadMock.mockReset();
  });

  it("returns parsed fields when the ATS quality gate fails instead of blocking", async () => {
    grokParseResumeCachedMock.mockResolvedValue(PARTIAL_PARSE);

    const result = await prepareResumeCandidate({
      resumeText: READABLE_RESUME,
      resumeTitle: "Jordan Lee resume",
    });

    expect(result.qualityOk).toBe(false);
    expect(result.qualityMessage).toBeTruthy();
    expect(result.parsed.first_name).toBe("Jordan");
    expect(result.parsed.email).toBe("jordan.lee@clinic.org");
    expect(result.parsedJson.email).toBe("jordan.lee@clinic.org");
  });

  it("falls back to regex extraction when Grok throws", async () => {
    grokParseResumeCachedMock.mockRejectedValue(new Error("xAI unavailable"));

    const result = await prepareResumeCandidate({
      resumeText: READABLE_RESUME,
    });

    expect(result.qualityOk).toBe(false);
    expect(result.parsed.email).toBe("jordan.lee@clinic.org");
    expect(result.parsed.phone).toContain("404");
  });

  it("does not throw when extracted file text is unreadable — recruiter can fill details", async () => {
    extractResumeTextFromUploadMock.mockResolvedValue("abc");
    const file = new File([new Uint8Array([1, 2, 3])], "Resume.pdf", {
      type: "application/pdf",
    });

    const result = await prepareResumeCandidate({ resumeFile: file });

    expect(result.qualityOk).toBe(false);
    expect(result.qualityMessage).toMatch(/does not look like a resume/i);
    expect(result.resumeBytes.byteLength).toBeGreaterThan(0);
  });

  it("still requires a resume file or pasted text", async () => {
    await expect(prepareResumeCandidate({})).rejects.toBeInstanceOf(JobValidationError);
  });
});
