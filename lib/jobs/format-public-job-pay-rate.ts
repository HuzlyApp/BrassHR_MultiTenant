export type PublicJobPayRateFields = {
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  pay_rate?: number | null;
  pay_rate_period?: string | null;
  rate_unit?: string | null;
  compensation_type?: string | null;
  show_pay_by?: string | null;
};

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPayAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function normalizeShowPayBy(value?: string | null): string {
  return String(value ?? "").trim();
}

function payRatePeriodToken(
  period?: string | null,
  rateUnit?: string | null,
  compensationType?: string | null
): string {
  const raw = String(period || rateUnit || compensationType || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw.includes("hour")) return "hour";
  if (raw.includes("day")) return "day";
  if (raw.includes("week")) return "week";
  if (raw.includes("month")) return "month";
  if (raw.includes("year") || raw.includes("annual")) return "year";
  if (raw.includes("flat")) return "flat";
  return raw.replace(/^per\s+/i, "").trim();
}

function formatPeriodLabel(period: string): string {
  switch (period) {
    case "hour":
      return "hour";
    case "day":
      return "day";
    case "week":
      return "week";
    case "month":
      return "Mo";
    case "year":
      return "year";
    case "flat":
      return "flat";
    default:
      return period;
  }
}

function formatPayAmountSegment(job: PublicJobPayRateFields): string | null {
  const suggested = toNumberOrNull(job.pay_rate);
  const min = toNumberOrNull(job.pay_rate_min);
  const max = toNumberOrNull(job.pay_rate_max);
  const showPayBy = normalizeShowPayBy(job.show_pay_by);

  const format = (value: number) => `$${formatPayAmount(value)}`;

  const hasDistinctRange = min != null && max != null && min !== max;
  const isRangeMode =
    showPayBy === "Range" ||
    (hasDistinctRange &&
      showPayBy !== "Exact amount" &&
      showPayBy !== "Starting amount");

  if (isRangeMode) {
    if (hasDistinctRange) {
      return `${format(min)} - ${format(max)}`;
    }
    const amount = min ?? max ?? suggested;
    return amount != null ? format(amount) : null;
  }

  // Exact amount / Starting amount — single value only.
  const amount = min ?? max ?? suggested;
  return amount != null ? format(amount) : null;
}

/** Value only, e.g. "$50 - $60 per hour" or "$85 per Mo". Returns null when no rate is set. */
export function formatPublicJobPayRate(job: PublicJobPayRateFields): string | null {
  const amount = formatPayAmountSegment(job);
  if (!amount) return null;

  const periodToken = payRatePeriodToken(
    job.pay_rate_period,
    job.rate_unit,
    job.compensation_type
  );
  const periodLabel = periodToken ? formatPeriodLabel(periodToken) : "";
  return periodLabel ? `${amount} per ${periodLabel}` : amount;
}
