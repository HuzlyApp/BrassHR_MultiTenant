import { describe, expect, it } from "vitest";
import { humanizeActivityAction } from "./humanize-activity-action";

describe("humanizeActivityAction", () => {
  it("maps known audit keys", () => {
    expect(humanizeActivityAction("worker.profile.view")).toBe("Viewed profile");
    expect(humanizeActivityAction("worker.checklist.view")).toBe("Viewed checklist");
  });

  it("keeps already human-readable labels", () => {
    expect(humanizeActivityAction("Applicant record created")).toBe("Applicant record created");
  });

  it("falls back to spaced title case", () => {
    expect(humanizeActivityAction("worker.attachments.view")).toBe("Viewed attachments");
    expect(humanizeActivityAction("custom.event.thing")).toMatch(/Thing|Custom/i);
  });
});
