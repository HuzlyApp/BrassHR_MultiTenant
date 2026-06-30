import type { WorkerAccountTab } from "@/app/application/components/applicant-portal/worker-account-types";

export function adminWorkerProfileHref(workerId: string, tab?: WorkerAccountTab) {
  const base = `/admin_recruiter/workers/${encodeURIComponent(workerId)}/profile`;
  if (!tab || tab === "overview") return base;
  return `${base}?tab=${tab}`;
}

export function adminWorkerAccountTabHref(workerId: string, tab: WorkerAccountTab): string {
  return adminWorkerProfileHref(workerId, tab);
}
