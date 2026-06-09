import { redirect } from "next/navigation";
import WorkerOnboardingError from "@/app/worker-onboarding/WorkerOnboardingError";
import { resolveWorkerOnboardingEntry } from "@/lib/onboarding/resolve-worker-onboarding-entry";

export default async function WorkerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant } = await searchParams;
  const result = await resolveWorkerOnboardingEntry(tenant);

  if (result.kind === "redirect") {
    redirect(result.url);
  }

  return (
    <WorkerOnboardingError
      code={result.code}
      message={result.message}
      tenantSlug={result.tenantSlug}
    />
  );
}
