import type { Metadata } from "next";
import BrassClientOnboardingWizard from "@/app/components/client-onboarding/BrassClientOnboardingWizard";

export const metadata: Metadata = {
  title: { absolute: "Client onboarding — BrassHR" },
  description: "Set up your BrassHR organization: goals, business profile, branding, and domain.",
};

export default function TenantOnboardingPage() {
  return <BrassClientOnboardingWizard />;
}
