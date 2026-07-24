import { jobDescriptionPlainText } from "@/lib/jobs/job-description-html";
import type { JobStatus } from "@/lib/jobs/types";

export type JobDetailsRow = {
  id: string;
  status: JobStatus | string;
  public_title: string | null;
  location: string | null;
  facility: string | null;
  facility_name: string | null;
  published_at: string | null;
  created_at: string | null;
  public_description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  benefits: string | null;
  schedule: string | null;
  location_type: string | null;
  pay_rate_min: number | null;
  pay_rate_max: number | null;
  pay_rate_period: string | null;
  rate_unit: string | null;
  suggested_pay_rate?: number | null;
  pay_rate?: number | null;
  required_credentials: string | string[] | null;
  special_requirements: string | null;
  public_job_token: string | null;
  application_deadline: string | null;
};

export type JobDetailsStats = {
  applicationsAll: number;
  applicationsNew: number;
  applicationsStarted: number;
  applicationsSubmittedOrHired: number;
  impressions: number;
  clicks: number;
  totalCost: number;
};

export function jobDetailsStatusLabel(status: string): string {
  switch (status) {
    case "published":
      return "Open";
    case "draft":
      return "Draft";
    case "closed":
      return "Closed";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export function jobDetailsStatusDotClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-[#3B82F6]";
    case "draft":
      return "bg-[#94A3B8]";
    case "closed":
    case "archived":
      return "bg-[#EF4444]";
    default:
      return "bg-[#94A3B8]";
  }
}

export function formatJobDetailsDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatJobDetailsPay(job: JobDetailsRow): string {
  const periodRaw = String(job.pay_rate_period || job.rate_unit || "").trim();
  const period = periodRaw
    ? periodRaw.toLowerCase().startsWith("per ")
      ? periodRaw.toLowerCase()
      : `per ${periodRaw.toLowerCase().replace(/^per\s+/i, "")}`
    : "";

  const min = job.pay_rate_min;
  const max = job.pay_rate_max;
  const single =
    job.suggested_pay_rate != null
      ? Number(job.suggested_pay_rate)
      : job.pay_rate != null
        ? Number(job.pay_rate)
        : null;

  if (min != null && max != null) {
    return period ? `$${min} - $${max} ${period}` : `$${min} - $${max}`;
  }
  if (min != null) return period ? `$${min} ${period}` : `$${min}`;
  if (max != null) return period ? `$${max} ${period}` : `$${max}`;
  if (single != null && !Number.isNaN(single)) {
    return period ? `$${single} ${period}` : `$${single}`;
  }
  return "—";
}

export function formatJobDetailsLocation(job: JobDetailsRow): string {
  return (
    job.location?.trim() ||
    job.facility_name?.trim() ||
    job.facility?.trim() ||
    job.location_type?.trim() ||
    "—"
  );
}

export function formatWorkLocationLabel(job: JobDetailsRow): string {
  const type = job.location_type?.trim();
  if (type === "On-site") return "In person";
  if (type) return type;
  if (job.schedule?.trim()) return job.schedule.trim();
  return formatJobDetailsLocation(job);
}

export function splitJobListContent(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const plain = jobDescriptionPlainText(value);
  if (!plain) return [];

  const bulletSplit = plain
    .split(/\n+|•|\u2022|(?:^|\n)\s*[-–—*]\s+/g)
    .map((item) => item.replace(/^[\s•\u2022\-–—*]+/, "").trim())
    .filter(Boolean);

  if (bulletSplit.length > 1) return bulletSplit;

  const commaSplit = plain
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (commaSplit.length > 1 && plain.length < 280) return commaSplit;

  return [plain];
}

export function preferredSkillsFromJob(job: JobDetailsRow): string[] {
  const credentials = Array.isArray(job.required_credentials)
    ? job.required_credentials.map((item) => String(item ?? "").trim()).filter(Boolean)
    : splitJobListContent(
        typeof job.required_credentials === "string" ? job.required_credentials : null
      );
  if (credentials.length) return credentials;
  return splitJobListContent(job.special_requirements);
}

export function performanceDateRangeLabel(job: JobDetailsRow): string {
  const start = formatJobDetailsDate(job.published_at || job.created_at);
  if (start === "—") return "Today";
  return `${start} - Today`;
}

export type StatusTransitionAction = "publish" | "unpublish" | "close" | "archive";

export function statusActionForTarget(
  current: string,
  target: JobStatus
): StatusTransitionAction | null {
  if (current === target) return null;
  if (target === "published") return "publish";
  if (target === "draft") return "unpublish";
  if (target === "closed") return "close";
  if (target === "archived") return "archive";
  return null;
}
