export const WORKER_PAY_RATE_PERIODS = ["Hourly", "Weekly", "Monthly"] as const;

export type WorkerPayRatePeriod = (typeof WORKER_PAY_RATE_PERIODS)[number];

const PERIOD_SUFFIX: Record<WorkerPayRatePeriod, string> = {
  Hourly: "/ hr",
  Weekly: "/ wk",
  Monthly: "/ mo",
};

export function isWorkerPayRatePeriod(value: string | null | undefined): value is WorkerPayRatePeriod {
  const trimmed = (value ?? "").trim();
  return (WORKER_PAY_RATE_PERIODS as readonly string[]).includes(trimmed);
}

export function normalizeWorkerPayRatePeriod(
  value: string | null | undefined
): WorkerPayRatePeriod {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw.includes("week")) return "Weekly";
  if (raw.includes("month")) return "Monthly";
  if (raw.includes("hour")) return "Hourly";
  return "Hourly";
}

export function payRatePeriodSuffix(period: string | null | undefined): string {
  return PERIOD_SUFFIX[normalizeWorkerPayRatePeriod(period)];
}

export function formatWorkerPayRateDisplay(
  amount: string | number | null | undefined,
  period: string | null | undefined
): string {
  if (amount == null) return "—";
  const cleaned = String(amount).replace(/[^0-9.]/g, "");
  if (!cleaned) return "—";
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return "—";
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `$ ${formatted} ${payRatePeriodSuffix(period)}`;
}

export function normalizeWorkerPayRateAmount(
  rawValue: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  const value = rawValue == null ? "" : String(rawValue).trim();
  if (!value) return { ok: false, error: "Pay rate is required." };
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(value)) {
    return { ok: false, error: "Enter a single positive pay rate with at most 2 decimal places." };
  }
  const n = Number(value);
  if (n <= 0 || !Number.isSafeInteger(Math.round(n * 100))) {
    return { ok: false, error: "Enter a valid pay rate greater than zero." };
  }
  return { ok: true, value: n.toFixed(2) };
}
