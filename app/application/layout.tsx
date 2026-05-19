import { Suspense } from "react";
import ApplicationOnboardingBootstrap from "./ApplicationOnboardingBootstrap";
import TenantQuerySync from "./TenantQuerySync";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationOnboardingBootstrap>
      <Suspense fallback={null}>
        <TenantQuerySync />
      </Suspense>
      {children}
    </ApplicationOnboardingBootstrap>
  );
}
