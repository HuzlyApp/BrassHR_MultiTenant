"use client";

import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerPayslipsClient } from "@/app/application/components/applicant-portal/WorkerPayslipsClient";

export default function WorkerPayslipsPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerPayslipsClient />
    </ApplicantPortalRoutePage>
  );
}
