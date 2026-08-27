"use client";

import { Suspense } from "react";
import { WorkerJobsTab } from "./WorkerJobsTab";

export function WorkerJobsClient() {
  return (
    <Suspense fallback={null}>
      <WorkerJobsTab />
    </Suspense>
  );
}
