"use client";

import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerTaskboardClient } from "@/app/application/components/applicant-portal/WorkerTaskboardClient";

export default function WorkerTaskboardPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerTaskboardClient />
    </ApplicantPortalRoutePage>
  );
}
