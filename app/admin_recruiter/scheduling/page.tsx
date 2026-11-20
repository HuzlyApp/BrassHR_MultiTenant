import { Suspense } from "react";
import SchedulePageClient from "@/app/admin_recruiter/scheduling/SchedulePageClient";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";

export default function AdminRecruiterSchedulingPage() {
  return (
    <Suspense fallback={<DashboardPageLoader />}>
      <SchedulePageClient />
    </Suspense>
  );
}
