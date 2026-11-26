"use client";

import { Suspense } from "react";
import { PortalSignInLoadingShell, PortalSignInScreen } from "@/app/worker-signin/PortalSignInScreen";

export default function CandidateSignInPage() {
  return (
    <Suspense fallback={<PortalSignInLoadingShell />}>
      <PortalSignInScreen portal="candidate" />
    </Suspense>
  );
}
