"use client";

import { ApplicantLicensesTab } from "@/app/application/components/applicant-portal/ApplicantLicensesTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerAccountShell } from "@/app/application/components/applicant-portal/WorkerAccountShell";

export default function ApplicantLicensesPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerAccountShell activeTab="skills">
        <ApplicantLicensesTab embedded />
      </WorkerAccountShell>
    </ApplicantPortalRoutePage>
  );
}
