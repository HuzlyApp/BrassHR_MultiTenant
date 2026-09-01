import { PDFDocument, StandardFonts } from "pdf-lib";
import { stripNullBytes } from "@/lib/resume/sanitize-postgres-text";

/** Strip control chars and map non–WinAnsi code points so pdf-lib can draw pasted resume text. */
export function sanitizeTextForPdfDrawing(text: string): string {
  return stripNullBytes(text)
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[^\t\n\r\x20-\xFF]/g, "?");
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const FONT_SIZE = 10;
const LINE_HEIGHT = FONT_SIZE * 1.35;

function wrapLine(line: string, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, maxWidth: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, FONT_SIZE) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) wrapped.push(current);
    current = word;
  }
  if (current) wrapped.push(current);
  return wrapped;
}

/** Store pasted resume text in worker-resumes bucket (PDF / DOCX only). */
export async function resumeTextToPdfBuffer(text: string): Promise<Buffer> {
  const safeText = sanitizeTextForPdfDrawing(text);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = () => {
    if (y >= MARGIN) return;
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  for (const rawLine of safeText.replace(/\r\n/g, "\n").split("\n")) {
    for (const line of wrapLine(rawLine, font, maxWidth)) {
      ensureSpace();
      page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font });
      y -= LINE_HEIGHT;
    }
  }

  return Buffer.from(await pdfDoc.save());
}
