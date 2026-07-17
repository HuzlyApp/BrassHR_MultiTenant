"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function TimesheetsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/application/applicant-dashboard/schedule?view=calendar&tab=timesheets");
  }, [router]);

  return null;
}

export default function ApplicantTimesheetsPage() {
  return (
    <Suspense fallback={null}>
      <TimesheetsRedirect />
    </Suspense>
  );
}
