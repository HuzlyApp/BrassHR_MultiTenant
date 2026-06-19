"use client";

import { Suspense } from "react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { ApplicantProfileTab } from "@/app/application/components/applicant-portal/ApplicantProfileTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantProfilePage() {
  return (
    <ApplicantPortalRoutePage>
      <Suspense fallback={<DashboardPageLoader label="Loading account..." className="min-h-[420px]" />}>
        <ApplicantProfileTab />
      </Suspense>
    </ApplicantPortalRoutePage>
  );
}
