import {
  EASTERN_TIME_ZONE,
  easternDateString,
  easternTimeString,
  easternWallClockToDate,
} from "@/lib/datetime/eastern";

/** Eastern calendar date `YYYY-MM-DD`. */
export function localDateString(date: Date): string {
  return easternDateString(date);
}

/** Eastern time `HH:MM:SS`. */
export function localTimeString(date: Date): string {
  return easternTimeString(date);
}

/** Parse `scheduled_date` + `start_time` / `end_time` as Eastern wall-clock. */
export function combineLocalDateAndTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const normalized = time.length === 5 ? `${time}:00` : time;
  const [hour, minute, second] = normalized.split(":").map(Number);
  return easternWallClockToDate(year, month, day, hour || 0, minute || 0, second || 0);
}

export function isoToScheduleFields(startsAt: Date, endsAt: Date, _timezone?: string) {
  return {
    scheduled_date: localDateString(startsAt),
    start_time: localTimeString(startsAt),
    end_time: localTimeString(endsAt),
    timezone: EASTERN_TIME_ZONE,
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
