"use client";

import { ApplicantLicensesTab } from "@/app/application/components/applicant-portal/ApplicantLicensesTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantLicensesPage() {
  return (
    <ApplicantPortalRoutePage>
      <ApplicantLicensesTab />
    </ApplicantPortalRoutePage>
  );
}
