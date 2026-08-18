"use client";

import { WorkerAccountApplicationsTab } from "@/app/application/components/applicant-portal/WorkerAccountApplicationsTab";
import { WORKER_PORTAL_PAGE_PAD_CLASS } from "@/app/application/components/applicant-portal/worker-schedule-typography";

export function MyApplicationsClient() {
  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <WorkerAccountApplicationsTab />
    </div>
  );
}
