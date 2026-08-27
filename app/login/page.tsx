import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import AuthBrandingShellStyles from "@/app/login/AuthBrandingShellStyles";
import { LoginBrandingBootstrap } from "@/app/login/LoginBrandingBootstrap";
import LoginPageClient from "@/app/login/LoginPageClient";
import { isRecruiterSignInRole } from "@/lib/auth/recruiter-sign-in";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { loadAuthTenantBranding } from "@/lib/tenant/load-public-tenant-branding";
import { buildTenantDocumentMetadata } from "@/lib/tenant/tenant-document-metadata";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readFirstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | null {
  const raw = searchParams[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function readTenantQuery(
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  const trimmed = readFirstParam(searchParams, "tenant");
  return trimmed && trimmed.length >= 2 ? trimmed : null;
}

export async function generateMetadata({ searchParams }: LoginPageProps): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const branding = await loadAuthTenantBranding({
    headers: await headers(),
    tenantSlugFromQuery: readTenantQuery(resolvedSearchParams),
    tenantSlugFromCookie: cookieStore.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null,
  });
  return buildTenantDocumentMetadata(branding);
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const branding = await loadAuthTenantBranding({
    headers: await headers(),
    tenantSlugFromQuery: readTenantQuery(resolvedSearchParams),
    tenantSlugFromCookie: cookieStore.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null,
  });
  const roleQuery = readFirstParam(resolvedSearchParams, "role");
  // `/admin` rewrite always sets role=admin_recruiter → solid primary shell.
  const useClassicAdminShell = isRecruiterSignInRole(roleQuery);

  return (
    <>
      <AuthBrandingShellStyles
        branding={branding}
        background={useClassicAdminShell ? "primary" : "gradient"}
      />
      <LoginBrandingBootstrap branding={branding}>
        <LoginPageClient />
      </LoginBrandingBootstrap>
    </>
  );
}
