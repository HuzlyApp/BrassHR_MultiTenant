import { describe, expect, it } from "vitest";
import { checkCommunicationRateLimit } from "@/lib/communication/rate-limit";

describe("checkCommunicationRateLimit", () => {
  it("allows first send", () => {
    const userId = `test-user-${Date.now()}-${Math.random()}`;
    expect(checkCommunicationRateLimit(userId).allowed).toBe(true);
  });
});
