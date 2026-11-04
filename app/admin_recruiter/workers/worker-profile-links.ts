import type { WorkerAccountTab } from "@/app/application/components/applicant-portal/worker-account-types";
import {
  workerFigmaProfileTabHref,
  type WorkerFigmaProfileTabId,
} from "./worker-profile-tabs";

export function adminWorkerProfileHref(workerId: string, tab?: WorkerAccountTab | WorkerFigmaProfileTabId) {
  const base = `/admin_recruiter/workers/${encodeURIComponent(workerId)}/profile`;
  if (!tab || tab === "overview" || tab === "profile") return base;
  if (
    tab === "work_history" ||
    tab === "licenses" ||
    tab === "files" ||
    tab === "skill_assessment" ||
    tab === "hire" ||
    tab === "activity"
  ) {
    return workerFigmaProfileTabHref(workerId, tab as WorkerFigmaProfileTabId);
  }
  return `${base}?tab=${tab}`;
}

export function adminWorkerAccountTabHref(workerId: string, tab: WorkerAccountTab): string {
  return adminWorkerProfileHref(workerId, tab);
}
