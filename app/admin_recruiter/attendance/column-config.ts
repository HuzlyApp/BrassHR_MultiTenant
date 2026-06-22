export type AttendanceColumnId =
  | "applicant"
  | "email"
  | "date"
  | "clockIn"
  | "clockOut"
  | "totalHours"
  | "clockInIp"
  | "clockOutIp"
  | "clockInLocation"
  | "clockOutLocation"
  | "status";

export const ATTENDANCE_COLUMN_OPTIONS: { id: AttendanceColumnId; label: string }[] = [
  { id: "applicant", label: "Applicant" },
  { id: "email", label: "Email" },
  { id: "date", label: "Date" },
  { id: "clockIn", label: "Clock In" },
  { id: "clockOut", label: "Clock Out" },
  { id: "totalHours", label: "Total Hours" },
  { id: "clockInIp", label: "Clock-in IP" },
  { id: "clockOutIp", label: "Clock-out IP" },
  { id: "clockInLocation", label: "Clock-in Location" },
  { id: "clockOutLocation", label: "Clock-out Location" },
  { id: "status", label: "Status" },
];

/** Default visible columns: five fields plus status. */
export const DEFAULT_ATTENDANCE_COLUMNS: AttendanceColumnId[] = [
  "applicant",
  "date",
  "clockIn",
  "clockOut",
  "totalHours",
  "status",
];

const STORAGE_KEY = "nexus-attendance-list-columns";

export function loadAttendanceColumnOrder(): AttendanceColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_ATTENDANCE_COLUMNS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_ATTENDANCE_COLUMNS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_ATTENDANCE_COLUMNS];
    const allowed = new Set(ATTENDANCE_COLUMN_OPTIONS.map((c) => c.id));
    const cleaned = parsed.filter(
      (id): id is AttendanceColumnId => typeof id === "string" && allowed.has(id as AttendanceColumnId)
    );
    return cleaned.length ? cleaned : [...DEFAULT_ATTENDANCE_COLUMNS];
  } catch {
    return [...DEFAULT_ATTENDANCE_COLUMNS];
  }
}

export function saveAttendanceColumnOrder(order: AttendanceColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore quota */
  }
}

export function attendanceColumnLabel(id: AttendanceColumnId): string {
  return ATTENDANCE_COLUMN_OPTIONS.find((c) => c.id === id)?.label ?? id;
}
