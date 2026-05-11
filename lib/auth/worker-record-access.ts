import type { ApiAuthContext } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";

export function canAccessWorkerRecord(
  auth: ApiAuthContext,
  worker: { id: string; user_id?: unknown }
): boolean {
  if (isStaffRole(auth.role)) return true;
  if (auth.role !== "worker") return false;
  const uid = worker.user_id != null ? String(worker.user_id).trim() : "";
  return uid.length > 0 && uid === auth.userId;
}
