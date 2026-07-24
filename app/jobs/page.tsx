import { Suspense } from "react";
import JobsPortalClient from "@/app/jobs/JobsPortalClient";

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading jobs…</div>}>
      <JobsPortalClient />
    </Suspense>
  );
}
