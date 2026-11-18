import { describe, expect, it } from "vitest";
import { FaqServiceError } from "@/lib/faqs/faq-service";

describe("FaqServiceError", () => {
  it("carries status and code for API mapping", () => {
    const error = new FaqServiceError("Question is required.", 400, "VALIDATION_ERROR");
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Question is required.");
  });
});
