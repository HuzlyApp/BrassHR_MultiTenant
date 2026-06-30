import { Suspense } from "react";
import ApplicationOnboardingBootstrap from "./ApplicationOnboardingBootstrap";
import TenantQuerySync from "./TenantQuerySync";
import ApplicantOnboardingGate from "./ApplicantOnboardingGate";
import ApplicantOnboardingRouteGuard from "@/app/components/onboarding/ApplicantOnboardingRouteGuard";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationOnboardingBootstrap>
      <Suspense fallback={null}>
        <TenantQuerySync />
      </Suspense>
      <ApplicantOnboardingGate>
        <ApplicantOnboardingRouteGuard>{children}</ApplicantOnboardingRouteGuard>
      </ApplicantOnboardingGate>
    </ApplicationOnboardingBootstrap>
  );
}
