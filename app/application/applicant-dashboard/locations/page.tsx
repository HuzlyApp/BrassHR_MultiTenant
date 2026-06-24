"use client";

import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerLocationsTab } from "@/app/application/components/applicant-portal/WorkerLocationsTab";

export default function WorkerLocationsPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerLocationsTab />
    </ApplicantPortalRoutePage>
  );
}
