import mammoth from "mammoth";

export const DOCX_PREVIEW_HTML_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Disposition": 'inline; filename="resume-preview.html"',
  "Cache-Control": "private, max-age=120",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
};

export function wrapResumePreviewHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resume preview</title>
  <style>
    html, body { margin: 0; background: #fff; color: #111827; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 15px;
      line-height: 1.45;
    }
    .resume-preview { max-width: 816px; margin: 0 auto; padding: 28px 36px 48px; }
    .resume-preview p { margin: 0 0 0.55em; }
    .resume-preview h1, .resume-preview h2, .resume-preview h3 {
      font-family: Arial, Helvetica, sans-serif;
      margin: 1em 0 0.4em;
      line-height: 1.25;
    }
    .resume-preview table { border-collapse: collapse; width: 100%; }
    .resume-preview td, .resume-preview th { vertical-align: top; padding: 0 8px 6px 0; }
    .resume-preview img { max-width: 100%; height: auto; }
    .resume-preview-message {
      font-family: Arial, Helvetica, sans-serif;
      color: #4B5563;
    }
  </style>
</head>
<body>
  <div class="resume-preview">${bodyHtml}</div>
</body>
</html>`;
}

export function wordResumePreviewFallbackHtml(message: string): string {
  return wrapResumePreviewHtml(
    `<p class="resume-preview-message">${escapePreviewText(message)}</p>`
  );
}

export async function buildDocxResumePreviewHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  const body = result.value?.trim() || "<p>This resume has no readable preview content.</p>";
  return wrapResumePreviewHtml(body);
}

function escapePreviewText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
