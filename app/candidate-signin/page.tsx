"use client";

import { Suspense } from "react";
import { PortalSignInLoadingShell, PortalSignInScreen } from "@/app/worker-signin/page";

export default function CandidateSignInPage() {
  return (
    <Suspense fallback={<PortalSignInLoadingShell />}>
      <PortalSignInScreen portal="candidate" />
    </Suspense>
  );
}
