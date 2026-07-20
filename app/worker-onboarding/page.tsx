import { redirect } from "next/navigation";
import WorkerOnboardingError from "@/app/worker-onboarding/WorkerOnboardingError";
import {
  JobApplicationGateError,
  resolveTenantApplicationEntry,
} from "@/lib/jobs/validate-job-application";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export default async function WorkerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant } = await searchParams;
  const supabase = createServiceRoleClient();

  if (supabase) {
    try {
      const route = await resolveTenantApplicationEntry(supabase, tenant);
      redirect(route.path);
    } catch (error) {
      if (error instanceof JobApplicationGateError && error.code === "TENANT_NOT_FOUND") {
        return (
          <WorkerOnboardingError
            code="TENANT_NOT_FOUND"
            message={error.message}
            tenantSlug={tenant ?? null}
          />
        );
      }
    }
  }

  return (
    <WorkerOnboardingError
      code="TENANT_NOT_FOUND"
      message="Applications must start from a published job listing."
      tenantSlug={tenant ?? null}
    />
  );
}
