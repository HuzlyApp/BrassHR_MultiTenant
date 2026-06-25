export const ATTENDANCE_BUCKETS = ["all", "ongoing", "completed", "unclaimed"] as const;

export type AttendanceBucket = (typeof ATTENDANCE_BUCKETS)[number];

export const ATTENDANCE_BUCKET_LABELS: Record<AttendanceBucket, string> = {
  all: "All",
  ongoing: "Ongoing",
  completed: "Completed",
  unclaimed: "Unclaimed",
};

export type AttendanceBucketCounts = Record<AttendanceBucket, number>;

export const EMPTY_ATTENDANCE_BUCKET_COUNTS: AttendanceBucketCounts = {
  all: 0,
  ongoing: 0,
  completed: 0,
  unclaimed: 0,
};

export function parseAttendanceBucket(value: string | null | undefined): AttendanceBucket {
  if (value === "ongoing" || value === "completed" || value === "unclaimed") return value;
  return "all";
}

export function attendanceBucketEmptyMessage(bucket: AttendanceBucket): string {
  switch (bucket) {
    case "ongoing":
      return "No one is clocked in right now.";
    case "completed":
      return "No completed attendance records yet.";
    case "unclaimed":
      return "No unclaimed attendance records.";
    default:
      return "No attendance logs found.";
  }
}
