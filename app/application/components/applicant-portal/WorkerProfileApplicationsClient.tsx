"use client";

import { WorkerAccountApplicationsTab } from "./WorkerAccountApplicationsTab";
import { WorkerAccountShell } from "./WorkerAccountShell";

/** @deprecated Use WorkerAccountApplicationsTab inside the worker profile shell. */
export function WorkerProfileApplicationsClient() {
  return (
    <WorkerAccountShell activeTab="applications">
      <WorkerAccountApplicationsTab />
    </WorkerAccountShell>
  );
}
