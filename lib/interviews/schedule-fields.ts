/** Local calendar date `YYYY-MM-DD` from a Date (browser/admin timezone). */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local time `HH:MM:SS` from a Date. */
export function localTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Parse `scheduled_date` + `start_time` / `end_time` as local wall-clock (modal timezone). */
export function combineLocalDateAndTime(date: string, time: string): Date {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}`);
}

export function isoToScheduleFields(startsAt: Date, endsAt: Date, timezone: string) {
  return {
    scheduled_date: localDateString(startsAt),
    start_time: localTimeString(startsAt),
    end_time: localTimeString(endsAt),
    timezone,
  };
}

export function scheduleRowToIso(
  scheduledDate: string,
  startTime: string,
  endTime: string | null
): { startsAt: string; endsAt: string | null } {
  const startsAt = combineLocalDateAndTime(scheduledDate, startTime).toISOString();
  const endsAt = endTime
    ? combineLocalDateAndTime(scheduledDate, endTime).toISOString()
    : null;
  return { startsAt, endsAt };
}
