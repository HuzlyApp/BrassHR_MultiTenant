"use client";

import { WorkerTicketsDepartmentsClient } from "@/app/application/components/applicant-portal/WorkerTicketsDepartmentsClient";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantTicketsDepartmentsPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerTicketsDepartmentsClient />
    </ApplicantPortalRoutePage>
  );
}
