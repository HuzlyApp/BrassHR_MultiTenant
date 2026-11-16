import type { SupabaseClient } from "@supabase/supabase-js";
import { easternDateString } from "@/lib/datetime/eastern";

export function splitRegularAndOvertimeMinutes(workedMinutes: number) {
  const total =
    !Number.isFinite(workedMinutes) || workedMinutes <= 0
      ? 0
      : Math.min(1440, Math.round(workedMinutes));
  return {
    regular_minutes: Math.min(480, total),
    overtime_minutes: Math.max(0, total - 480),
  };
}

/** The shared database transaction now updates daily entries and weekly totals together. */
export async function syncAttendanceDayToTimesheet(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    applicantWorkerId: string;
    attendanceDate?: string;
    now?: Date;
  },
): Promise<{ synced: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc("sync_attendance_timesheet_day", {
    p_tenant: input.tenantId,
    p_candidate: input.applicantWorkerId,
    p_day: input.attendanceDate ?? easternDateString(input.now ?? new Date()),
  });
  if (error) throw error;
  return data === true
    ? { synced: true }
    : {
        synced: false,
        reason: "No linked employee or attendance sessions for this day.",
      };
}
