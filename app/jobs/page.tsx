import { headers } from "next/headers";
import { Suspense } from "react";
import JobsPortalClient from "@/app/jobs/JobsPortalClient";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { loadPublicTenantBranding } from "@/lib/tenant/load-public-tenant-branding";
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
  const label = fromQuery || fromHeader || fromHost;

  if (!label || !isTenantApplicantPortalSlug(label)) {
    return brandingFallbackForSlug(label);
  }

  try {
    // Query/header labels may be slug or subdomain; subdomain lookup falls back to slug.
    return await loadPublicTenantBranding(
      fromHost && label === fromHost
        ? { hostSubdomain: label }
        : { subdomain: label }
    );
  } catch {
    return brandingFallbackForSlug(label);
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
