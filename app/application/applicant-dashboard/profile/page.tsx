"use client";

import { ApplicantProfileTab } from "@/app/application/components/applicant-portal/ApplicantProfileTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantProfilePage() {
  return (
    <ApplicantPortalRoutePage>
      <ApplicantProfileTab />
    </ApplicantPortalRoutePage>
  );
}
