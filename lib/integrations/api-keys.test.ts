import { describe, expect, it } from "vitest";
import { generateInboundApiKey, INBOUND_API_KEY_PREFIX } from "@/lib/integrations/api-keys";

describe("inbound API keys", () => {
  it("generates a prefixed key with a stable hash length", () => {
    const first = generateInboundApiKey();
    const second = generateInboundApiKey();

    expect(first.apiKey.startsWith(INBOUND_API_KEY_PREFIX)).toBe(true);
    expect(first.keyPrefix).toBe(first.apiKey.slice(0, 12));
    expect(first.keyHash).toHaveLength(64);
    expect(first.apiKey).not.toEqual(second.apiKey);
    expect(first.keyHash).not.toEqual(second.keyHash);
  });
});
