import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPublishedJobByToken } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; job_token?: string }>;
}) {
  const query = await searchParams;
  const token = query.job_token?.trim();
  const supabase = createServiceRoleClient();
  if (!supabase || !token) notFound();

  const hostTenant = resolveRequestTenantHost(await headers()).subdomainLabel;
  const tenant = await resolvePublicTenant(supabase, query.tenant ?? hostTenant);
  if (!tenant) notFound();
  const job = await getPublishedJobByToken(supabase, tenant.id, token);
  if (!job) notFound();

  redirect(
    `/application/add-resume?tenant=${encodeURIComponent(tenant.slug)}&job_token=${encodeURIComponent(token)}`
  );
}
