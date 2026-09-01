import { describe, expect, it } from "vitest";
import { resumeTextToPdfBuffer, sanitizeTextForPdfDrawing } from "@/lib/resume/resume-text-to-pdf";

describe("sanitizeTextForPdfDrawing", () => {
  it("removes null bytes that break WinAnsi encoding", () => {
    expect(sanitizeTextForPdfDrawing("Almog\u0000 Arazi")).toBe("Almog Arazi");
  });
});

describe("resumeTextToPdfBuffer", () => {
  it("builds a PDF from pasted resume text with null bytes", async () => {
    const buffer = await resumeTextToPdfBuffer("Jordan Lee\u0000\nRN at Memorial Hospital");
    expect(buffer.byteLength).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
