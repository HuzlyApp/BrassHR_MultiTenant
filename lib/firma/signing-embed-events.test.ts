import { describe, expect, it } from "vitest";
import {
  isAllowedFirmaSigningMessageOrigin,
  isFirmaSigningCompletePath,
  isFirmaSigningCompletedMessage,
  parseFirmaSigningEmbedMessage,
} from "@/lib/firma/signing-embed-events";

describe("Firma signing embed completion events", () => {
  it("detects Firma complete event type variants", () => {
    expect(isFirmaSigningCompletedMessage({ type: "signing.completed" })).toBe(true);
    expect(isFirmaSigningCompletedMessage({ type: "firma:signing:completed" })).toBe(true);
    expect(isFirmaSigningCompletedMessage({ event: "signing.completed" })).toBe(true);
    expect(isFirmaSigningCompletedMessage({ type: "signing.started" })).toBe(false);
  });

  it("detects the Firma complete route", () => {
    expect(isFirmaSigningCompletePath("/signing/recipient-1/complete")).toBe(true);
    expect(isFirmaSigningCompletePath("/signing/recipient-1")).toBe(false);
  });

  it("accepts same-origin proxy and Firma app origins", () => {
    expect(
      isAllowedFirmaSigningMessageOrigin("http://localhost:3000", {
        pageOrigin: "http://localhost:3000",
        firmaAppOrigin: "https://app.firma.dev",
      })
    ).toBe(true);
    expect(
      isAllowedFirmaSigningMessageOrigin("https://app.firma.dev", {
        pageOrigin: "http://localhost:3000",
        firmaAppOrigin: "https://app.firma.dev",
      })
    ).toBe(true);
    expect(
      isAllowedFirmaSigningMessageOrigin("https://evil.example", {
        pageOrigin: "http://localhost:3000",
        firmaAppOrigin: "https://app.firma.dev",
      })
    ).toBe(false);
  });

  it("parses a trusted completion message", () => {
    expect(
      parseFirmaSigningEmbedMessage(
        { origin: "https://app.firma.dev", data: { type: "signing.completed" } },
        { pageOrigin: "http://localhost:3000", firmaAppOrigin: "https://app.firma.dev" }
      )
    ).toBe("completed");
  });
});
