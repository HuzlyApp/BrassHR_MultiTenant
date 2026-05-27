import { redirect } from "next/navigation";

/** Legacy route — onboarding builder lives under recruiter settings. */
export default function LegacyOnboardingBuilderPage() {
  redirect("/admin_recruiter/settings?tab=onboarding-builder");
}
