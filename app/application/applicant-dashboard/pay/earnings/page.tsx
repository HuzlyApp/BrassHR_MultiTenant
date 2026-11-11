"use client";

import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerEarningsClient } from "@/app/application/components/applicant-portal/WorkerEarningsClient";

export default function WorkerEarningsPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerEarningsClient />
    </ApplicantPortalRoutePage>
  );
}
