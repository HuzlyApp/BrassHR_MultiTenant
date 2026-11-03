import { Suspense } from "react";
import TeamProductivityClient from "@/app/admin_recruiter/reports/team-productivity/TeamProductivityClient";

function LoadingFallback() {
  return (
    <div className="px-4 py-[30px] font-[Inter,sans-serif] text-sm text-[#6B7280] sm:px-6 lg:px-8">
      Loading Team Productivity KPI…
    </div>
  );
}

export default function TeamProductivityReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TeamProductivityClient />
    </Suspense>
  );
}
