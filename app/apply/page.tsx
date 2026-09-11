import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { JobApplicationGateError, resolveTenantApplicationEntry, validatePublishedJobForApplication } from "@/lib/jobs/validate-job-application";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";
import { SERVICE_AREA_COPY } from "@/lib/service-area/copy";
import ApplyWorkLocationClient from "@/app/apply/ApplyWorkLocationClient";

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
      redirect(route.path);
    } catch (error) {
      if (error instanceof JobApplicationGateError) notFound();
      throw error;
    }
  }

  try {
    const validated = await validatePublishedJobForApplication(supabase, tenantSlug, token);
    return (
      <ApplyWorkLocationClient
        tenantSlug={validated.tenantSlug}
        jobToken={validated.jobToken}
        jobTitle={validated.jobTitle}
        jobCity={validated.jobLocation}
        continueHref={validated.screeningPath}
      />
    );
  } catch (error) {
    if (error instanceof JobApplicationGateError) {
      return <ApplicationUnavailable message={SERVICE_AREA_COPY.opening_unavailable} />;
    }
    throw error;
  }
}
