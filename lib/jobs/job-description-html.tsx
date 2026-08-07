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

/**
 * Remove a Benefits section from job-description HTML/plain text so it is not
 * duplicated when benefits are already shown in a dedicated UI block.
 */
export function stripJobDescriptionBenefitsSection(value: string): string {
  const content = (value ?? "").trim();
  if (!content) return "";

  if (!looksLikeHtml(content)) {
    return content
      .replace(/(?:^|\n)\s*Benefits\s*(?:\n|$)[\s\S]*$/i, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const withoutHeadingBenefits = content.replace(
    /<h([2-4])(?:\s[^>]*)?>\s*Benefits\s*<\/h\1>(?:(?!<h[2-4]\b)[\s\S])*/gi,
    ""
  );

  const withoutStrongBenefits = withoutHeadingBenefits.replace(
    /<(p)(?:\s[^>]*)?>\s*<(strong|b)>\s*Benefits\s*<\/\2>\s*(?:<br\s*\/?>)?\s*<\/\1>(?:(?!<(?:h[2-4]|p)\b[^>]*>\s*<(?:strong|b)>)[\s\S])*/gi,
    ""
  );

  return withoutStrongBenefits
    .replace(/<(?:p|div|ul|ol)(?:\s[^>]*)?>\s*<\/(?:p|div|ul|ol)>/gi, "")
    .replace(/(?:\s*<br\s*\/?>\s*)+$/gi, "")
    .trim();
}

const LIST_SECTION_HEADING =
  /^(?:key\s+responsibilities|responsibilities|qualifications|required\s+qualifications|preferred\s+qualifications|preferred\s+skills|benefits)$/i;

function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function isSectionHeadingHtml(block: string): boolean {
  const text = stripTags(block).replace(/[:.\s]+$/g, "").trim();
  if (!text || text.length > 80) return false;
  if (/^<(?:h[2-4])\b/i.test(block.trim())) return true;
  if (/^<p\b[^>]*>\s*<(?:strong|b)>/i.test(block.trim()) && !/<br\s*\/?>/i.test(block)) {
    return true;
  }
  return (
    LIST_SECTION_HEADING.test(text) ||
    /^(?:about the role|benefits|work location(?: and schedule)?)$/i.test(text)
  );
}

function isListSectionHeading(block: string): boolean {
  const text = stripTags(block).replace(/[:.\s]+$/g, "").trim();
  return LIST_SECTION_HEADING.test(text);
}

function splitBlockItems(block: string): string[] {
  const withBreaks = block
    .replace(/<\/(?:p|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const plain = stripTags(withBreaks);
  return plain
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\u2022\-–—*]+/, "").trim())
    .filter(Boolean);
}

function toBulletList(items: string[]): string {
  if (!items.length) return "";
  return `<ul>${items
    .map(
      (item) =>
        `<li>${item
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")}</li>`
    )
    .join("")}</ul>`;
}

/**
 * Ensure Key Responsibilities / Qualifications content renders as bullet lists,
 * even when the stored HTML used paragraphs or line breaks instead of <ul>/<li>.
 */
export function ensureJobDescriptionBulletLists(value: string): string {
  const content = (value ?? "").trim();
  if (!content || !looksLikeHtml(content)) return content;

  const tokens =
    content.match(/<(?:h[2-4]|p|ul|ol)(?:\s[^>]*)?>[\s\S]*?<\/(?:h[2-4]|p|ul|ol)>/gi) ?? [];
  if (!tokens.length) return content;

  const output: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    output.push(token);

    if (!isListSectionHeading(token)) {
      i += 1;
      continue;
    }

    i += 1;
    if (i >= tokens.length) break;

    const next = tokens[i];
    if (/^<(?:ul|ol)\b/i.test(next.trim())) {
      output.push(next);
      i += 1;
      continue;
    }

    const collected: string[] = [];

    // One paragraph with multiple lines/breaks → list items
    if (/^<p\b/i.test(next.trim()) && /<br\s*\/?>/i.test(next) && !isSectionHeadingHtml(next)) {
      collected.push(...splitBlockItems(next));
      i += 1;
    } else {
      // Consecutive short paragraphs → list items
      while (i < tokens.length) {
        const block = tokens[i];
        if (/^<(?:ul|ol|h[2-4])\b/i.test(block.trim()) || isSectionHeadingHtml(block)) break;
        if (!/^<p\b/i.test(block.trim())) break;
        const items = splitBlockItems(block);
        if (!items.length) break;
        // Long paragraph under a list heading is usually a single note; stop collecting.
        if (items.length === 1 && items[0].length > 180 && collected.length === 0) break;
        collected.push(...items);
        i += 1;
      }
    }

    if (collected.length) {
      output.push(toBulletList(collected));
    }
  }

  const rebuilt = output.join("");
  return rebuilt || content;
}

export function JobDescriptionHtml({
  html,
  className = "",
  emptyLabel = "—",
}: {
  html: string;
  className?: string;
  emptyLabel?: string;
}) {
  const content = html.trim();
  if (!content) return <p className={className}>{emptyLabel}</p>;

  if (!looksLikeHtml(content)) {
    return <p className={`whitespace-pre-wrap ${className}`}>{content}</p>;
  }

  return (
    <div
      className={`job-description-html prose prose-sm max-w-none text-sm leading-6 text-slate-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
