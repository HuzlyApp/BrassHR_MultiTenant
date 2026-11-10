/**
 * Allowlist HTML sanitizer for AI-generated job descriptions.
 * Only tags used by the job description editor are kept.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "br",
]);

const HEADING_AS_PARAGRAPH = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** contentEditable often saves lines as <div>; normalize to <p> for safe display. */
const BLOCK_AS_PARAGRAPH = new Set([...HEADING_AS_PARAGRAPH, "div"]);

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip tags/attrs; keep only allowlisted structure. */
export function sanitizeJobDescriptionHtml(raw: string): string {
  const input = (raw ?? "").trim();
  if (!input) return "";

  // Remove script/style blocks entirely before tag walk.
  const withoutDangerous = input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const parts: string[] = [];
  const tokenRe = /<\/?([a-z0-9]+)(\s[^>]*)?>|([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(withoutDangerous)) !== null) {
    const tagName = match[1]?.toLowerCase();
    const textChunk = match[3];

    if (textChunk != null) {
      parts.push(escapeText(decodeBasicEntities(textChunk)));
      continue;
    }

    const full = match[0];
    const isClosing = full.startsWith("</");
    if (tagName && BLOCK_AS_PARAGRAPH.has(tagName)) {
      parts.push(isClosing ? "</p>" : "<p>");
      continue;
    }
    if (!tagName || !ALLOWED_TAGS.has(tagName)) continue;

    if (tagName === "br") {
      parts.push("<br>");
      continue;
    }
    parts.push(isClosing ? `</${tagName}>` : `<${tagName}>`);
  }

  return parts.join("").trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Convert plain text paragraphs/newlines into the same HTML shape the job editor stores. */
export function plainTextJobDescriptionToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Normalize inbound/API job descriptions to safe editor HTML.
 * HTML input is allowlisted (p/ul/ol/li/strong/em/b/i/br); plain text becomes paragraphs.
 */
export function normalizeJobDescriptionInput(raw: string | null | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  if (looksLikeHtml(input)) {
    return sanitizeJobDescriptionHtml(input) || null;
  }
  return plainTextJobDescriptionToHtml(input) || null;
}

export function htmlToPlainText(html: string): string {
  return sanitizeJobDescriptionHtml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Known job-description section titles that should render bold in the editor. */
const SECTION_TITLES = [
  "About the Role",
  "Key Responsibilities",
  "Required Qualifications",
  "Preferred Qualifications",
  "Qualifications",
  "Work Location and Schedule",
  "Benefits",
] as const;

/**
 * Ensure section titles are wrapped in <strong> after AI generation.
 * Does not change body copy or list markup.
 */
export function boldJobDescriptionSectionTitles(html: string): string {
  const input = (html ?? "").trim();
  if (!input) return "";

  let result = input;
  for (const title of SECTION_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // <p|h2-h4>Title</…> or already partially bold → <…><strong>Title</strong></…>
    result = result.replace(
      new RegExp(
        `<(p|h[2-4])>\\s*(?:<(?:strong|b)>)?\\s*${escaped}\\s*:?\\s*(?:</(?:strong|b)>)?\\s*</\\1>`,
        "gi"
      ),
      `<$1><strong>${title}</strong></$1>`
    );
  }
  return result;
}

