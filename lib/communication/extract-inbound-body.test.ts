import { describe, expect, it } from "vitest";
import { extractInboundEmailBody } from "@/lib/communication/extract-inbound-body";

describe("extractInboundEmailBody", () => {
  it("prefers plain text", () => {
    expect(
      extractInboundEmailBody({ text: "Reply text", html: "<p>html</p>", subject: "Re: hi" })
    ).toBe("Reply text");
  });

  it("falls back to stripped html", () => {
    expect(
      extractInboundEmailBody({ text: null, html: "<p>Hello <b>world</b></p>", subject: "Re: hi" })
    ).toBe("Hello world");
  });

  it("does not return empty for Re: subjects without body", () => {
    const body = extractInboundEmailBody({ text: null, html: null, subject: "" }, "Re: bitch");
    expect(body).toContain("Re: bitch");
    expect(body.length).toBeGreaterThan(0);
  });
});
