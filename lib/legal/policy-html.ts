import type { LegalSection } from "@/lib/legal/types";

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
  "span",
  "h2",
  "h3",
]);

const BLOCK_AS_PARAGRAPH = new Set(["div", "h1", "h4", "h5", "h6"]);

const FONT_SIZE_TO_PX: Record<string, number> = {
  "1": 12,
  "2": 13,
  "3": 14,
  "4": 16,
  "5": 18,
  "6": 24,
  "7": 32,
};

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function normalizeFontTags(html: string): string {
  return html
    .replace(/<font\b[^>]*\bsize\s*=\s*["']?([1-7])["']?[^>]*>/gi, (_, size: string) => {
      const px = FONT_SIZE_TO_PX[size] ?? 16;
      return `<span style="font-size:${px}px">`;
    })
    .replace(/<\/font>/gi, "</span>");
}

function sanitizeSpanOpenTag(attrs: string | undefined): string | null {
  if (!attrs) return "<span>";
  const styleMatch = attrs.match(/style\s*=\s*(["'])(.*?)\1/i);
  if (!styleMatch) return "<span>";
  const fontSize = styleMatch[2].match(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|rem|em)/i);
  if (!fontSize) return "<span>";
  return `<span style="font-size:${fontSize[1]}${fontSize[2]}">`;
}

/** Allowlist HTML for legal policy editor (job-description style + font-size spans). */
export function sanitizeLegalPolicyHtml(raw: string): string {
  const input = normalizeFontTags((raw ?? "").trim());
  if (!input) return "";

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
    const attrs = match[2];

    if (tagName && BLOCK_AS_PARAGRAPH.has(tagName)) {
      parts.push(isClosing ? "</p>" : "<p>");
      continue;
    }
    if (!tagName || !ALLOWED_TAGS.has(tagName)) continue;

    if (tagName === "br") {
      parts.push("<br>");
      continue;
    }
    if (tagName === "span") {
      if (isClosing) {
        parts.push("</span>");
      } else {
        const open = sanitizeSpanOpenTag(attrs);
        if (open) parts.push(open);
      }
      continue;
    }
    parts.push(isClosing ? `</${tagName}>` : `<${tagName}>`);
  }

  return parts.join("").trim();
}

function stripTags(value: string): string {
  return value
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

/** Convert stored legal sections into one editor HTML body (titles bold, paragraphs arranged). */
export function legalSectionsToHtml(sections: LegalSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    const title = section.title?.trim();
    if (title) {
      parts.push(`<p><strong>${escapeText(title)}</strong></p>`);
    }

    const bullets: string[] = [];
    const flushBullets = () => {
      if (bullets.length === 0) return;
      parts.push(`<ul>${bullets.map((b) => `<li>${escapeText(b)}</li>`).join("")}</ul>`);
      bullets.length = 0;
    };

    for (const raw of section.paragraphs ?? []) {
      const paragraph = (raw ?? "").trim();
      if (!paragraph) continue;

      if (looksLikeHtml(paragraph)) {
        flushBullets();
        parts.push(sanitizeLegalPolicyHtml(paragraph));
        continue;
      }

      if (paragraph.startsWith("•")) {
        bullets.push(paragraph.replace(/^•\s*/, "").trim());
        continue;
      }

      flushBullets();
      parts.push(`<p>${escapeText(paragraph).replace(/\n/g, "<br>")}</p>`);
    }
    flushBullets();
  }

  return parts.join("").trim();
}

function isHeadingBlock(html: string): { title: string } | null {
  const trimmed = html.trim();
  const heading = trimmed.match(/^<h[23]>([\s\S]*?)<\/h[23]>$/i);
  if (heading) {
    const title = stripTags(heading[1]).trim();
    return title ? { title } : null;
  }

  const strongOnly = trimmed.match(
    /^<p>\s*<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>\s*<\/p>$/i
  );
  if (strongOnly) {
    const title = stripTags(strongOnly[1]).trim();
    // Treat short bold lines as section titles (policy headings).
    if (title && title.length <= 300 && !title.includes("\n")) {
      return { title };
    }
  }
  return null;
}

function blockToParagraph(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  const listMatch = trimmed.match(/^<ul>([\s\S]*)<\/ul>$/i);
  if (listMatch) {
    const items = [...listMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) =>
      `• ${stripTags(m[1]).trim()}`
    );
    return items.filter(Boolean).join("\n\n");
  }

  // Keep inline formatting inside the paragraph when present.
  const inner = trimmed.replace(/^<p>/i, "").replace(/<\/p>$/i, "").trim();
  if (looksLikeHtml(inner) && /<(strong|em|b|i|span|br)\b/i.test(inner)) {
    return sanitizeLegalPolicyHtml(`<p>${inner}</p>`);
  }
  return stripTags(trimmed);
}

/** Convert editor HTML back into legal sections for storage. */
export function legalHtmlToSections(html: string): LegalSection[] {
  const sanitized = sanitizeLegalPolicyHtml(html);
  if (!sanitized) return [];

  const blocks =
    sanitized.match(/<(?:p|h2|h3|ul)\b[\s\S]*?<\/(?:p|h2|h3|ul)>/gi) ??
    (sanitized ? [`<p>${sanitized}</p>`] : []);

  const sections: LegalSection[] = [];
  let current: LegalSection | null = null;

  const ensureCurrent = (title = "Content") => {
    if (!current) {
      current = { title, paragraphs: [] };
      sections.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    const heading = isHeadingBlock(block);
    if (heading) {
      current = { title: heading.title, paragraphs: [] };
      sections.push(current);
      continue;
    }

    if (/^<ul>/i.test(block.trim())) {
      const items = [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map(
        (m) => `• ${stripTags(m[1]).trim()}`
      );
      const target = ensureCurrent();
      for (const item of items) {
        if (item.replace(/^•\s*/, "").trim()) target.paragraphs.push(item);
      }
      continue;
    }

    const paragraph = blockToParagraph(block);
    if (!paragraph) continue;
    // Multi-bullet string from nested conversion
    if (paragraph.includes("\n\n•")) {
      const target = ensureCurrent();
      for (const part of paragraph.split(/\n{2,}/)) {
        if (part.trim()) target.paragraphs.push(part.trim());
      }
      continue;
    }
    ensureCurrent().paragraphs.push(paragraph);
  }

  return sections.filter((s) => s.title.trim() && s.paragraphs.length > 0);
}

export function legalPolicyPlainText(html: string): string {
  return stripTags(sanitizeLegalPolicyHtml(html));
}
