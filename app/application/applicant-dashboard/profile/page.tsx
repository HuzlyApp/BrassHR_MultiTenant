"use client";

import { Suspense } from "react";
import { ApplicantProfileTab } from "@/app/application/components/applicant-portal/ApplicantProfileTab";
import { ApplicantPortalRoutePage } from "@/app/application/components/applicant-portal/ApplicantPortalRoutePage";

export default function ApplicantProfilePage() {
  return (
    <ApplicantPortalRoutePage>
      <Suspense fallback={null}>
        <ApplicantProfileTab />
      </Suspense>
    </ApplicantPortalRoutePage>
  );
}
