"use client";

import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerUserSettingsProfilePanel } from "@/app/application/components/applicant-portal/WorkerUserSettingsProfilePanel";

export default function WorkerUserSettingsProfilePage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerUserSettingsProfilePanel />
    </ApplicantPortalRoutePage>
  );
}
