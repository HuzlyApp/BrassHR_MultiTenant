import { describe, expect, it } from "vitest";
import {
  coerceAcceptedFileTypes,
  isAcceptedDocumentFileType,
} from "@/lib/document-upload-helpers";

const NURSING_LICENSE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const STANDARD_TYPES = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "doc",
  "docx",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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

  it("ignores octet-stream and trusts the file extension", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "application/octet-stream", name: "license.pdf" },
        NURSING_LICENSE_TYPES
      )
    ).toBe(true);
    expect(
      isAcceptedDocumentFileType(
        { type: "application/octet-stream", name: "license.docx" },
        STANDARD_TYPES
      )
    ).toBe(true);
  });

  it("strips MIME parameters like charset", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "application/pdf; charset=utf-8", name: "license.pdf" },
        NURSING_LICENSE_TYPES
      )
    ).toBe(true);
  });

  it("allows doc/docx against the standard allow-list", () => {
    expect(
      isAcceptedDocumentFileType(
        { type: "application/msword", name: "license.doc" },
        STANDARD_TYPES
      )
    ).toBe(true);
    expect(
      isAcceptedDocumentFileType(
        {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          name: "license.docx",
        },
        STANDARD_TYPES
      )
    ).toBe(true);
  });

  it("parses postgres text-array style accepted types", () => {
    const allowed = coerceAcceptedFileTypes("{application/pdf,image/jpeg,image/png}");
    expect(allowed).toEqual(["application/pdf", "image/jpeg", "image/png"]);
    expect(
      isAcceptedDocumentFileType({ type: "image/png", name: "x.png" }, allowed)
    ).toBe(true);
  });
});
