import ApplicationOnboardingBootstrap from "./ApplicationOnboardingBootstrap"

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <ApplicationOnboardingBootstrap>{children}</ApplicationOnboardingBootstrap>
}
