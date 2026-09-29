/** All user-facing dates and times use US Eastern Time (EST/EDT). */
export const EASTERN_TIME_ZONE = "America/New_York";
export const EASTERN_TIME_LABEL = "Eastern Time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type EasternParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getEasternParts(date: Date): EasternParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  let hour = Number(readPart(parts, "hour"));
  if (hour === 24) hour = 0;

  return {
    year: Number(readPart(parts, "year")),
    month: Number(readPart(parts, "month")),
    day: Number(readPart(parts, "day")),
    hour,
    minute: Number(readPart(parts, "minute")),
    second: Number(readPart(parts, "second")),
    weekday: readPart(parts, "weekday"),
  };
}

function easternOffsetMs(utcMillis: number): number {
  const parts = getEasternParts(new Date(utcMillis));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - utcMillis;
}

/** Calendar wall-clock in Eastern Time, as an absolute instant. */
export function easternWallClockToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = easternOffsetMs(utcGuess);
  let result = utcGuess - offset;
  const offset2 = easternOffsetMs(result);
  if (offset2 !== offset) result = utcGuess - offset2;
  return new Date(result);
}

export function easternDateString(date: Date): string {
  const parts = getEasternParts(date);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function easternTimeString(date: Date): string {
  const parts = getEasternParts(date);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const second = String(parts.second).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}

export function easternHour(date: Date): number {
  return getEasternParts(date).hour;
}

export function easternWeekdayIndex(date: Date): number {
  const weekday = getEasternParts(date).weekday;
  const index = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  return index >= 0 ? index : 0;
}

export function startOfEasternDay(date: Date): Date {
  const parts = getEasternParts(date);
  return easternWallClockToDate(parts.year, parts.month, parts.day, 0, 0, 0);
}

export function addEasternDays(date: Date, days: number): Date {
  const parts = getEasternParts(startOfEasternDay(date));
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return easternWallClockToDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), 0, 0, 0);
}

export function startOfEasternWeek(date: Date): Date {
  const start = startOfEasternDay(date);
  return addEasternDays(start, -easternWeekdayIndex(start));
}

export function endOfEasternDay(date: Date): Date {
  return new Date(addEasternDays(startOfEasternDay(date), 1).getTime() - 1);
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Format an instant in Eastern Time. A `YYYY-MM-DD` calendar date stays on that date. */
export function formatEastern(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  fallback = ""
): string {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" && isDateOnlyString(value)) {
    const [year, month, day] = value.trim().split("-").map(Number);
    const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...options,
      timeZone: "UTC",
    }).format(noonUtc);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: EASTERN_TIME_ZONE,
  }).format(date);
}
