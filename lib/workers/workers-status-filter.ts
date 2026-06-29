import type { WorkerStatus } from "@/lib/workers/workers-status-types";

export function statusVariants(s: WorkerStatus): string[] {
  const title = s.slice(0, 1).toUpperCase() + s.slice(1);
  const upper = s.toUpperCase();
  return Array.from(new Set([s, title, upper]));
}

export function statusFilterValues(
  s: WorkerStatus,
  col: "worker_status" | "status"
): string[] {
  if (col === "worker_status") {
    return [s];
  }
  return statusVariants(s);
}

/** PostgREST `.or()` filter for worker status columns (includes null for "new"). */
export function statusOrFilter(col: "status" | "worker_status", status: WorkerStatus): string {
  const variants = statusFilterValues(status, col);
  const inList = variants.join(",");
  if (status === "new") {
    return `${col}.in.(${inList}),${col}.is.null`;
  }
  return `${col}.in.(${inList})`;
}

export function parseWorkersListParams(searchParams: URLSearchParams) {
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50) || 50, 1), 500);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);
  return { limit, offset, rangeEnd: offset + limit - 1 };
}
