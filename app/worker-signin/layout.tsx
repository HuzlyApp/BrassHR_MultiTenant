import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { loadAuthTenantBranding } from "@/lib/tenant/load-public-tenant-branding";
import { buildTenantDocumentMetadata } from "@/lib/tenant/tenant-document-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const headerList = await headers();
  const branding = await loadAuthTenantBranding({
    headers: headerList,
    tenantSlugFromQuery: headerList.get("x-tenant-slug"),
    tenantSlugFromCookie: cookieStore.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null,
  });
  return buildTenantDocumentMetadata(branding);
}

export default function WorkerSignInLayout({ children }: { children: ReactNode }) {
  return children;
}
