"use client";

import { ApplicantDocumentsTab } from "@/app/application/components/applicant-portal/ApplicantDocumentsTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";
import { WorkerAccountShell } from "@/app/application/components/applicant-portal/WorkerAccountShell";

export default function ApplicantDocumentsPage() {
  return (
    <ApplicantPortalRoutePage>
      <WorkerAccountShell activeTab="documents">
        <ApplicantDocumentsTab embedded />
      </WorkerAccountShell>
    </ApplicantPortalRoutePage>
  );
}
