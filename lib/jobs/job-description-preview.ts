import {
  ensureBulletListHtml,
  jobDescriptionPlainText,
  looksLikeHtml,
} from "@/lib/jobs/job-description-html";

export type JobDescriptionPreviewSection = {
  title: string;
  html: string;
  asList?: boolean;
};

const KNOWN_SECTION_TITLES =
  /^(about the role|key responsibilities|responsibilities|qualifications|benefits)$/i;

function normalizeSectionTitle(title: string): string {
  if (/^responsibilities$/i.test(title.trim())) return "Key Responsibilities";
  return title.trim();
}

function countStructuredSectionHeadings(html: string): number {
  if (!looksLikeHtml(html)) return 0;
  const headings = [...html.matchAll(/<strong\b[^>]*>\s*([^<]+?)\s*<\/strong>/gi)].map((match) =>
    (match[1] ?? "").trim()
  );
  return headings.filter((heading) => KNOWN_SECTION_TITLES.test(heading)).length;
}

function splitStructuredJobDescription(html: string): JobDescriptionPreviewSection[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(
    /(<p\b[^>]*>\s*<strong\b[^>]*>\s*[^<]+?\s*<\/strong>\s*<\/p>)/gi
  );

  const sections: JobDescriptionPreviewSection[] = [];
  let currentTitle: string | null = null;
  let currentBody = "";

  for (const part of parts) {
    const headingMatch = part.match(
      /<p\b[^>]*>\s*<strong\b[^>]*>\s*([^<]+?)\s*<\/strong>\s*<\/p>/i
    );
    if (headingMatch) {
      const title = normalizeSectionTitle(headingMatch[1] ?? "");
      if (!KNOWN_SECTION_TITLES.test(title)) {
        if (currentTitle) currentBody += part;
        continue;
      }
      if (currentTitle && currentBody.trim()) {
        sections.push({
          title: currentTitle,
          html: currentBody.trim(),
          asList: shouldRenderSectionAsList(currentTitle),
        });
      }
      currentTitle = title;
      currentBody = "";
      continue;
    }
    if (part.trim()) currentBody += part;
  }

  if (currentTitle && currentBody.trim()) {
    sections.push({
      title: currentTitle,
      html: currentBody.trim(),
      asList: shouldRenderSectionAsList(currentTitle),
    });
  }

  return sections;
}

function shouldRenderSectionAsList(title: string): boolean {
  return /^(key responsibilities|responsibilities|qualifications|benefits)$/i.test(title);
}

function stripSectionHeading(html: string, title: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  const variants = [title];
  if (title === "Key Responsibilities") variants.push("Responsibilities");

  for (const variant of variants) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (looksLikeHtml(trimmed)) {
      const withoutHtmlHeading = trimmed
        .replace(
          new RegExp(
            `^\\s*<p\\b[^>]*>\\s*<strong\\b[^>]*>\\s*${escaped}\\s*<\\/strong>\\s*<\\/p>\\s*`,
            "i"
          ),
          ""
        )
        .replace(new RegExp(`^\\s*<p\\b[^>]*>\\s*${escaped}\\s*<\\/p>\\s*`, "i"), "")
        .trim();
      if (withoutHtmlHeading !== trimmed) return withoutHtmlHeading;
    }

    const plain = jobDescriptionPlainText(trimmed);
    const withoutPlainHeading = plain.replace(new RegExp(`^\\s*${escaped}\\s*\\n*`, "i"), "").trim();
    if (withoutPlainHeading !== plain) {
      return looksLikeHtml(trimmed) ? trimmed : withoutPlainHeading;
    }
  }

  return trimmed;
}

function addPreviewSection(
  sections: JobDescriptionPreviewSection[],
  title: string,
  html: string | null | undefined,
  asList = false
) {
  const content = stripSectionHeading(html?.trim() || "", title);
  if (!content) return;
  sections.push({
    title,
    html: asList ? ensureBulletListHtml(content) : content,
    asList,
  });
}

/** Build non-duplicated preview sections from job description fields. */
export function buildJobDescriptionPreviewSections(job: {
  publicDescription: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
}): JobDescriptionPreviewSection[] {
  const publicDescription = job.publicDescription?.trim() || "";
  const structuredHeadingCount = countStructuredSectionHeadings(publicDescription);

  if (structuredHeadingCount >= 2) {
    const parsed = splitStructuredJobDescription(publicDescription);
    if (parsed.length) return parsed;
  }

  const sections: JobDescriptionPreviewSection[] = [];
  addPreviewSection(sections, "About the Role", publicDescription);
  addPreviewSection(sections, "Key Responsibilities", job.responsibilities, true);
  addPreviewSection(sections, "Qualifications", job.qualifications, true);
  addPreviewSection(sections, "Benefits", job.benefits, true);
  return sections;
}
