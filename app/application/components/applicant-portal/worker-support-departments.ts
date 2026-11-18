import {
  SUPPORT_DEPARTMENTS,
  getSupportDepartmentByCategory,
  isSupportDeskOnline,
  type SupportDepartment,
} from "@/lib/support-tickets/support-departments";

export type WorkerSupportDepartment = SupportDepartment;

/** Support desk categories shown on the worker Departments tab (design). */
export const WORKER_SUPPORT_DEPARTMENTS: WorkerSupportDepartment[] = SUPPORT_DEPARTMENTS;

/** Rough online window for Mon–Sat 11:00–23:00 America/New_York. */
export function isWorkerSupportDeskOnline(now = new Date()): boolean {
  return isSupportDeskOnline(now);
}

export { getSupportDepartmentByCategory };
