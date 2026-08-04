/** Shared helpers for job description HTML vs plain text. */

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function jobDescriptionPlainText(value: string): string {
  const raw = value ?? "";
  if (!looksLikeHtml(raw)) return raw.trim();
  return raw
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

function stripInlineHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/^[\s•\u2022\-–—*]+/, "")
    .trim();
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Turn paragraphs / line breaks / bare text into a real <ul> so bullets render on detail pages. */
export function ensureBulletListHtml(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  if (/<(ul|ol)\b/i.test(trimmed)) {
    return trimmed;
  }

  const liItems = [...trimmed.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripInlineHtml(match[1] ?? ""))
    .filter(Boolean);
  if (liItems.length) {
    return `<ul>${liItems.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
  }

  const pItems = [...trimmed.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripInlineHtml(match[1] ?? ""))
    .filter((item) => item && item !== "");
  if (pItems.length > 1) {
    return `<ul>${pItems.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
  }

  const plain = looksLikeHtml(trimmed) ? jobDescriptionPlainText(trimmed) : trimmed;
  const lines = plain
    .split(/\n+|•|\u2022|(?:^|\n)\s*[-–—*]\s+/g)
    .map((item) => item.replace(/^[\s•\u2022\-–—*]+/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return `<ul>${lines.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
  }
  if (lines.length === 1) {
    return `<ul><li>${escapeText(lines[0])}</li></ul>`;
  }
  return trimmed;
}

const LIST_SECTION_HEADINGS =
  /^(Key Responsibilities|Responsibilities|Qualifications|Benefits|Preferred Skills)$/i;

/**
 * Inside a full job-description HTML blob, convert paragraph clusters under list
 * section headings into <ul>/<li> so detail screens show bullet points.
 */
export function normalizeJobDescriptionLists(html: string): string {
  const trimmed = (html ?? "").trim();
  if (!trimmed || !looksLikeHtml(trimmed)) return trimmed;

  // Split on section headings like <p><strong>Key Responsibilities</strong></p>
  const parts = trimmed.split(
    /(<p\b[^>]*>\s*<strong\b[^>]*>\s*[^<]+?\s*<\/strong>\s*<\/p>)/gi
  );
  if (parts.length < 2) return trimmed;

  let result = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? "";
    const headingMatch = part.match(
      /<p\b[^>]*>\s*<strong\b[^>]*>\s*([^<]+?)\s*<\/strong>\s*<\/p>/i
    );
    if (headingMatch) {
      result += part;
      const title = (headingMatch[1] ?? "").trim();
      const body = parts[i + 1] ?? "";
      if (LIST_SECTION_HEADINGS.test(title) && body && !/<(ul|ol)\b/i.test(body)) {
        const listHtml = ensureBulletListHtml(
          body
            .replace(/(<p>\s*<br\s*\/?>\s*<\/p>\s*)+/gi, "")
            .trim()
        );
        result += listHtml || body;
        i += 1;
      }
      continue;
    }
    result += part;
  }
  return result || trimmed;
}

/** Class name hook — real list styles live in globals.css (.job-description-html). */
export const JOB_DESCRIPTION_HTML_CLASS =
  "job-description-html prose prose-sm max-w-none text-sm leading-7 text-slate-700";

export function JobDescriptionHtml({
  html,
  className = "",
  emptyLabel = "—",
  asList = false,
}: {
  html: string;
  className?: string;
  emptyLabel?: string;
  /** When true, coerce plain / paragraph content into a bullet list. */
  asList?: boolean;
}) {
  let content = html.trim();
  if (!content) return <p className={className}>{emptyLabel}</p>;

  if (asList) {
    content = ensureBulletListHtml(content);
  } else if (looksLikeHtml(content)) {
    content = normalizeJobDescriptionLists(content);
  }

  if (!looksLikeHtml(content)) {
    if (asList) {
      const listHtml = ensureBulletListHtml(content);
      return (
        <div
          className={`${JOB_DESCRIPTION_HTML_CLASS} ${className}`}
          dangerouslySetInnerHTML={{ __html: listHtml }}
        />
      );
    }
    return <p className={`whitespace-pre-wrap leading-7 ${className}`}>{content}</p>;
  }

  return (
    <div
      className={`${JOB_DESCRIPTION_HTML_CLASS} ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
