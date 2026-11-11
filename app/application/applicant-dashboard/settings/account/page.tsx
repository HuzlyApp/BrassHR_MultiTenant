"use client";

import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerUserSettingsAccountPanel } from "@/app/application/components/applicant-portal/WorkerUserSettingsAccountPanel";

export default function WorkerUserSettingsAccountPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerUserSettingsAccountPanel />
    </ApplicantPortalRoutePage>
  );
}
