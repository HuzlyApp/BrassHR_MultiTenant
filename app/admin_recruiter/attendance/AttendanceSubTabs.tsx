"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ATTENDANCE_BUCKETS,
  ATTENDANCE_BUCKET_LABELS,
  type AttendanceBucket,
  parseAttendanceBucket,
} from "@/lib/attendance/attendance-buckets";

function buildHref(pathname: string, bucket: AttendanceBucket, searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams.toString());
  if (bucket === "all") {
    params.delete("bucket");
  } else {
    params.set("bucket", bucket);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function tabButtonClass(active: boolean): string {
  if (active) {
    return "inline-flex h-6 w-auto items-center justify-center rounded-md bg-[color:var(--brand-primary)] px-3.5 py-1 text-sm font-medium leading-4 text-white transition-colors";
  }
  return "inline-flex h-6 w-auto items-center rounded-md py-1 text-sm font-medium leading-4 text-[#475569] transition-colors hover:text-[color:var(--brand-primary)]";
}

export function AttendanceSubTabs() {
  const pathname = usePathname() ?? "/admin_recruiter/attendance";
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeBucket = parseAttendanceBucket(searchParams.get("bucket"));

  return (
    <nav aria-label="Attendance views" className="mb-5 flex flex-wrap items-center gap-3">
      {ATTENDANCE_BUCKETS.map((bucket) => {
        const active = activeBucket === bucket;

        return (
          <button
            key={bucket}
            type="button"
            onClick={() => router.replace(buildHref(pathname, bucket, searchParams), { scroll: false })}
            className={tabButtonClass(active)}
            aria-current={active ? "page" : undefined}
          >
            <span className="whitespace-nowrap">{ATTENDANCE_BUCKET_LABELS[bucket]}</span>
          </button>
        );
      })}
    </nav>
  );
}
