import "server-only";

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfParse from "pdf-parse";

const require = createRequire(import.meta.url);

let workerConfigured = false;

/**
 * pdf.js reads `bytes.buffer` from index 0. A Node Buffer under 8KB is often a
 * view into the shared pool, so those extra bytes shift the cross-reference
 * table and a valid PDF throws "bad XRef entry".
 */
export function standalonePdfBytes(buffer: Buffer | Uint8Array): Uint8Array {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy;
}

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  workerConfigured = true;
  try {
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  } catch {
    // pdfjs then falls back to its own worker path next to the package.
  }
}

type PdfTextItem = { str: string; transform: ArrayLike<number> };

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object" || !("str" in item)) return false;
  const str = (item as { str?: unknown }).str;
  return typeof str === "string";
}

async function extractWithPdfjs(data: Uint8Array): Promise<string> {
  ensurePdfWorker();
  const doc = await getDocument({
    data,
    verbosity: 0,
    isEvalSupported: false,
  }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!isPdfTextItem(item)) continue;
        const y = Number(item.transform[5]);
        if (lastY != null && y !== lastY) {
          lines.push(line);
          line = item.str;
        } else {
          line += item.str;
        }
        lastY = y;
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }
    return pages.join("\n\n");
  } finally {
    await doc.destroy();
  }
}

/**
 * Read text from a PDF. Uses pdfjs-dist (not the pdf-parse bundle) and retries
 * once with pdf-parse if that reader throws.
 */
export async function extractPdfText(buffer: Buffer | Uint8Array): Promise<string> {
  try {
    return await extractWithPdfjs(standalonePdfBytes(buffer));
  } catch (primaryError) {
    try {
      const parsed = await pdfParse(Buffer.from(standalonePdfBytes(buffer)));
      return parsed.text || "";
    } catch {
      throw primaryError;
    }
  }
}
