"use client";

import { Suspense } from "react";
import { WorkerPortalPageLoader } from "@/app/application/components/applicant-portal/WorkerPortalPageLoader";
import { ApplicantProfileTab } from "@/app/application/components/applicant-portal/ApplicantProfileTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantProfilePage() {
  return (
    <ApplicantPortalRoutePage>
      <Suspense fallback={<WorkerPortalPageLoader label="Loading account..." />}>
        <ApplicantProfileTab />
      </Suspense>
    </ApplicantPortalRoutePage>
  );
}
