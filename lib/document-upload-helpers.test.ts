import { describe, expect, it } from "vitest";
import { isAcceptedDocumentFileType } from "@/lib/document-upload-helpers";

const NURSING_LICENSE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

describe("isAcceptedDocumentFileType", () => {
  it("allows listed MIME types", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "application/pdf", name: "license.pdf" },
        NURSING_LICENSE_TYPES
      )
    ).toBe(true);
  });

  it("treats image/jpg as image/jpeg", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "image/jpg", name: "license.jpg" },
        NURSING_LICENSE_TYPES
      )
    ).toBe(true);
  });

  it("allows webp when images are accepted", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "image/webp", name: "license.webp" },
        NURSING_LICENSE_TYPES
      )
    ).toBe(true);
  });

  it("matches by file extension when browser MIME is missing", () => {
    expect(
      isAcceptedDocumentFileType({ type: "", name: "license.JPG" }, NURSING_LICENSE_TYPES)
    ).toBe(true);
  });

  it("accepts shorthand types like pdf and .png", () => {
    expect(
      isAcceptedDocumentFileType({ type: "application/pdf", name: "a.pdf" }, ["pdf"])
    ).toBe(true);
    expect(
      isAcceptedDocumentFileType({ type: "image/png", name: "a.png" }, [".png"])
    ).toBe(true);
  });

  it("rejects types outside the allowed family", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "application/msword", name: "license.doc" },
        NURSING_LICENSE_TYPES
      )
    ).toBe(false);
  });
});
