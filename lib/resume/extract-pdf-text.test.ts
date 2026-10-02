import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "./extract-pdf-text";

async function samplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Shabeer Bokhari Security Analyst", { x: 50, y: 700, size: 18, font });
  return Buffer.from(await doc.save());
}

describe("extractPdfText", () => {
  it("reads text from a PDF", async () => {
    const text = await extractPdfText(await samplePdf());
    expect(text).toContain("Shabeer Bokhari");
  });

  it("reads a PDF that is a view into a larger buffer", async () => {
    const pdf = await samplePdf();
    const slab = Buffer.alloc(pdf.length + 256, 0x41);
    pdf.copy(slab, 64);
    const view = slab.subarray(64, 64 + pdf.length);
    expect(view.byteOffset).toBeGreaterThan(0);

    const text = await extractPdfText(view);
    expect(text).toContain("Shabeer Bokhari");
  });
});
