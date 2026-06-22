"use client";

import { ApplicantTicketsClient } from "@/app/application/components/applicant-portal/ApplicantTicketsClient";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantTicketsPage() {
  return (
    <ApplicantPortalRoutePage>
      <ApplicantTicketsClient />
    </ApplicantPortalRoutePage>
  );
}
