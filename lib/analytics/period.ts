export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "quarter"
  | "year"
  | "custom";

export type ResolvedPeriod = {
  preset: DateRangePreset;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function resolvePeriod(
  preset: DateRangePreset,
  options?: { now?: Date; customStart?: string | null; customEnd?: string | null },
): ResolvedPeriod {
  const now = options?.now ?? new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  let start = todayStart;
  let end = todayEnd;
  let label = "Today";

  switch (preset) {
    case "today":
      start = todayStart;
      end = todayEnd;
      label = "Today";
      break;
    case "yesterday": {
      const y = addDays(todayStart, -1);
      start = startOfDay(y);
      end = endOfDay(y);
      label = "Yesterday";
      break;
    }
    case "last_7_days":
      start = startOfDay(addDays(todayStart, -6));
      end = todayEnd;
      label = "Last 7 days";
      break;
    case "last_30_days":
      start = startOfDay(addDays(todayStart, -29));
      end = todayEnd;
      label = "Last 30 days";
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = todayEnd;
      label = "This month";
      break;
    case "last_month": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      label = "Last month";
      break;
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = todayEnd;
      label = "This quarter";
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      end = todayEnd;
      label = "This year";
      break;
    case "custom": {
      const cs = options?.customStart ? new Date(options.customStart) : todayStart;
      const ce = options?.customEnd ? new Date(options.customEnd) : todayEnd;
      start = startOfDay(Number.isFinite(cs.getTime()) ? cs : todayStart);
      end = endOfDay(Number.isFinite(ce.getTime()) ? ce : todayEnd);
      if (start > end) {
        const tmp = start;
        start = startOfDay(end);
        end = endOfDay(tmp);
      }
      label = `${formatShort(start)} – ${formatShort(end)}`;
      break;
    }
    default:
      start = startOfDay(addDays(todayStart, -6));
      end = todayEnd;
      label = "Last 7 days";
  }

  const durationMs = Math.max(end.getTime() - start.getTime(), 0);
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    preset,
    start,
    end,
    previousStart,
    previousEnd,
    label,
  };
}

export function parsePreset(value: string | null | undefined): DateRangePreset {
  const allowed: DateRangePreset[] = [
    "today",
    "yesterday",
    "last_7_days",
    "last_30_days",
    "this_month",
    "last_month",
    "quarter",
    "year",
    "custom",
  ];
  if (value && (allowed as string[]).includes(value)) return value as DateRangePreset;
  return "last_7_days";
}

export function toIso(d: Date): string {
  return d.toISOString();
}
