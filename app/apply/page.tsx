import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  JobApplicationGateError,
  resolveTenantApplicationEntry,
  validatePublishedJobForApplication,
} from "@/lib/jobs/validate-job-application";
import { NO_OPEN_POSITIONS_MESSAGE, normalizeJobToken } from "@/lib/jobs/public-application-routing";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";

function ApplicationUnavailable({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Applications unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; job_token?: string; workflow_id?: string }>;
}) {
  const query = await searchParams;
  const supabase = createServiceRoleClient();
  if (!supabase) notFound();

  const hostTenant = resolveRequestTenantHost(await headers()).subdomainLabel;
  const tenantSlug = query.tenant?.trim().toLowerCase() || hostTenant || "";

  if (query.workflow_id?.trim()) {
    return (
      <ApplicationUnavailable message="Applications must start from a published job listing." />
    );
  }

  const token = normalizeJobToken(query.job_token);
  if (!token) {
    try {
      const route = await resolveTenantApplicationEntry(supabase, tenantSlug);
      if (route.kind === "empty") {
        return <ApplicationUnavailable message={NO_OPEN_POSITIONS_MESSAGE} />;
      }
      redirect(route.path);
    } catch (error) {
      if (error instanceof JobApplicationGateError) notFound();
      throw error;
    }
  }

  try {
    const validated = await validatePublishedJobForApplication(supabase, tenantSlug, token);
    redirect(validated.resumeUploadPath);
  } catch (error) {
    if (error instanceof JobApplicationGateError) {
      return <ApplicationUnavailable message={error.message} />;
    }
    throw error;
  }
}
