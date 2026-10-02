import { describe, expect, it } from "vitest";
import { capJobListBodyFields, JOB_LIST_BODY_TEXT_CAP } from "@/lib/jobs/cap-job-list-text";

describe("capJobListBodyFields", () => {
  it("leaves typical job text unchanged", () => {
    const job = { id: "1", public_description: "<p>ICU nights</p>", qualifications: "RN" };
    expect(capJobListBodyFields(job)).toBe(job);
  });

  it("caps an oversized description and keeps the title", () => {
    const job = {
      id: "1",
      public_title: "RN",
      public_description: `<p>${"word ".repeat(JOB_LIST_BODY_TEXT_CAP)}</p>`,
    };
    const capped = capJobListBodyFields(job);
    expect(capped.public_title).toBe("RN");
    expect(capped.id).toBe("1");
    expect(String(capped.public_description).length).toBeLessThanOrEqual(JOB_LIST_BODY_TEXT_CAP);
    expect(String(capped.public_description)).not.toContain("<p>");
  });
});
