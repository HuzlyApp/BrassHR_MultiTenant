"use client";

import { ApplicantDocumentsTab } from "@/app/application/components/applicant-portal/ApplicantDocumentsTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantDocumentsPage() {
  return (
    <ApplicantPortalRoutePage>
      <ApplicantDocumentsTab />
    </ApplicantPortalRoutePage>
  );
}
