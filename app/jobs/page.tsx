import { headers } from "next/headers";
import { Suspense } from "react";
import JobsPortalClient from "@/app/jobs/JobsPortalClient";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { loadTenantBrandingBySlug } from "@/lib/tenant/load-tenant-branding-server";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";
import {
  brandingFallbackForSlug,
  isTenantApplicantPortalSlug,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

type JobsPageProps = {
  searchParams: Promise<{ tenant?: string }>;
};

async function resolveJobsBoardBranding(tenantQuery?: string): Promise<TenantBranding> {
  const requestHeaders = await headers();
  const fromQuery = tenantQuery?.trim().toLowerCase() || null;
  const fromHeader = requestHeaders.get("x-tenant-slug")?.trim().toLowerCase() || null;
  const fromHost = resolveRequestTenantHost(requestHeaders).subdomainLabel;
  const slug = fromQuery || fromHeader || fromHost;

  if (!slug || !isTenantApplicantPortalSlug(slug)) {
    return brandingFallbackForSlug(slug);
  }

  try {
    return await loadTenantBrandingBySlug(slug);
  } catch {
    return brandingFallbackForSlug(slug);
  }
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const query = await searchParams;
  const branding = await resolveJobsBoardBranding(query.tenant);

  return (
    <TenantBrandingProvider branding={branding}>
      <Suspense
        fallback={<div className="p-10 text-center text-sm text-slate-500">Loading jobs…</div>}
      >
        <JobsPortalClient />
      </Suspense>
    </TenantBrandingProvider>
  );
}
