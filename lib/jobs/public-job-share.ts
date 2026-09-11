import { htmlToPlainText } from "@/lib/jobs/generate-job-description/sanitize-html";
import { parseCityStateLocation } from "@/lib/location/city-state";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";

export const PUBLIC_JOB_SHARE_PLATFORMS = ["linkedin", "facebook", "x", "email"] as const;
export type PublicJobSharePlatform = (typeof PUBLIC_JOB_SHARE_PLATFORMS)[number];

/** Crawlable public job posting URL used when sharing across job platforms. */
export function buildPublicJobSharePath(
  tenantSlug: string,
  jobToken: string | null | undefined
): string | null {
  const slug = tenantSlug.trim().toLowerCase();
  const token = normalizeJobToken(jobToken);
  if (!slug || !token) return null;
  return `/jobs/${encodeURIComponent(token)}?tenant=${encodeURIComponent(slug)}`;
}

export function absolutePublicJobShareUrl(
  path: string,
  origin?: string | null
): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) return "";
  const base = origin?.trim();
  if (!base) return trimmedPath;
  try {
    return new URL(trimmedPath, base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return trimmedPath;
  }
}

export function publicJobShareDescription(html: string, maxLength = 160): string {
  const plain = htmlToPlainText(html).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= maxLength) return plain;
  const sliced = plain.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = sliced.lastIndexOf(" ");
  const trimmed = (lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trim();
  return `${trimmed}…`;
}

export function publicJobPlatformShareUrl(
  platform: PublicJobSharePlatform,
  input: { url: string; title: string; companyName?: string }
): string {
  const url = encodeURIComponent(input.url);
  const title = input.title.trim();
  const company = input.companyName?.trim() ?? "";
  const text = company ? `${title} at ${company}` : title;
  switch (platform) {
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${url}&text=${encodeURIComponent(text)}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(text || "Job opening")}&body=${encodeURIComponent(input.url)}`;
  }
}

export type ShareOrCopyPublicJobResult = "shared" | "copied" | "aborted" | "unavailable";

export async function copyPublicJobShareUrl(url: string): Promise<boolean> {
  const value = url.trim();
  if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  await navigator.clipboard.writeText(value);
  return true;
}

export async function shareOrCopyPublicJobUrl(input: {
  url: string;
  title: string;
}): Promise<ShareOrCopyPublicJobResult> {
  const url = input.url.trim();
  if (!url) return "unavailable";
  const title = input.title.trim() || "Job opening";

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "aborted";
    }
  }

  return (await copyPublicJobShareUrl(url)) ? "copied" : "unavailable";
}

function schemaEmploymentType(value?: string | null): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "w2") return "FULL_TIME";
  if (raw === "1099" || raw === "contract") return "CONTRACTOR";
  return "OTHER";
}

function schemaPayUnit(period?: string | null): string | null {
  const raw = String(period ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("hour")) return "HOUR";
  if (raw.includes("day")) return "DAY";
  if (raw.includes("week")) return "WEEK";
  if (raw.includes("month")) return "MONTH";
  if (raw.includes("year") || raw.includes("annual")) return "YEAR";
  return null;
}

function schemaDatePosted(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function schemaValidThrough(value?: string | null): string | null {
  const day = value?.trim();
  if (!day) return null;
  const date = new Date(`${day}T23:59:59.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function buildPublicJobPostingJsonLd(input: {
  url: string;
  title: string;
  descriptionHtml: string;
  companyName: string;
  companyLogoUrl?: string | null;
  location?: string | null;
  locationType?: string | null;
  employmentType?: string | null;
  datePosted?: string | null;
  validThrough?: string | null;
  payRateMin?: number | null;
  payRateMax?: number | null;
  payRate?: number | null;
  payRatePeriod?: string | null;
  currency?: string | null;
}): Record<string, unknown> {
  const posting: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: input.title,
    description: input.descriptionHtml || input.title,
    url: input.url,
    identifier: input.url,
  };

  const datePosted = schemaDatePosted(input.datePosted);
  if (datePosted) posting.datePosted = datePosted;
  const validThrough = schemaValidThrough(input.validThrough);
  if (validThrough) posting.validThrough = validThrough;

  const employmentType = schemaEmploymentType(input.employmentType);
  if (employmentType) posting.employmentType = employmentType;

  const organization: Record<string, unknown> = {
    "@type": "Organization",
    name: input.companyName.trim() || "Employer",
  };
  const logo = input.companyLogoUrl?.trim();
  if (logo && /^https?:\/\//i.test(logo)) organization.logo = logo;
  posting.hiringOrganization = organization;

  const locationType = String(input.locationType ?? "").trim().toLowerCase();
  const isRemote = locationType.includes("remote") && !locationType.includes("hybrid");
  if (isRemote) {
    posting.jobLocationType = "TELECOMMUTE";
  }

  const parsed = parseCityStateLocation(input.location);
  if (parsed.city || parsed.stateCode || parsed.zipCode) {
    const address: Record<string, unknown> = {
      "@type": "PostalAddress",
      addressCountry: "US",
    };
    if (parsed.city) address.addressLocality = parsed.city;
    if (parsed.stateCode) address.addressRegion = parsed.stateCode;
    if (parsed.zipCode) address.postalCode = parsed.zipCode;
    posting.jobLocation = {
      "@type": "Place",
      address,
    };
  } else if (!isRemote && input.location?.trim()) {
    posting.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: input.location.trim(),
        addressCountry: "US",
      },
    };
  }

  const min = input.payRateMin;
  const max = input.payRateMax;
  const exact = input.payRate;
  const hasRange = min != null && max != null && min !== max;
  const amount = exact ?? min ?? max;
  if (hasRange || typeof amount === "number") {
    const quantitative: Record<string, unknown> = { "@type": "QuantitativeValue" };
    if (hasRange) {
      quantitative.minValue = min;
      quantitative.maxValue = max;
    } else {
      quantitative.value = amount;
    }
    const unit = schemaPayUnit(input.payRatePeriod);
    if (unit) quantitative.unitText = unit;
    posting.baseSalary = {
      "@type": "MonetaryAmount",
      currency: (input.currency || "USD").trim().toUpperCase() || "USD",
      value: quantitative,
    };
  }

  return posting;
}
