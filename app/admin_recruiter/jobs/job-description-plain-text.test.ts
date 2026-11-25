import { describe, expect, it } from "vitest";
import { jobDescriptionPlainText } from "./JobDescriptionEditor";

describe("job description review text", () => {
  it("decodes entities even when the description contains no HTML tags", () => {
    expect(jobDescriptionPlainText("&nbsp;Care &amp; support")).toBe("Care & support");
    expect(jobDescriptionPlainText("<p>&nbsp;Care &amp; support</p>")).toBe("Care & support");
    expect(jobDescriptionPlainText("Use < 5 items &amp; > 2 staff")).toBe("Use < 5 items & > 2 staff");
  });
});
