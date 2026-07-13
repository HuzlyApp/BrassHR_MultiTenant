"use client";

import { Suspense } from "react";
import { ApplicantProfileTab } from "@/app/application/components/applicant-portal/ApplicantProfileTab";

export default function ApplicantProfilePage() {
  return (
    <Suspense fallback={null}>
      <ApplicantProfileTab />
    </Suspense>
  );
}
