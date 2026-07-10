import { cookies, headers } from "next/headers";
import AuthBrandingShellStyles from "@/app/login/AuthBrandingShellStyles";
import { LoginBrandingBootstrap } from "@/app/login/LoginBrandingBootstrap";
import LoginPageClient from "@/app/login/LoginPageClient";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { loadAuthTenantBranding } from "@/lib/tenant/load-public-tenant-branding";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readTenantQuery(
  searchParams: Record<string, string | string[] | undefined>
): string | null {
  const raw = searchParams.tenant;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= 2 ? trimmed : null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const branding = await loadAuthTenantBranding({
    headers: await headers(),
    tenantSlugFromQuery: readTenantQuery(resolvedSearchParams),
    tenantSlugFromCookie: cookieStore.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value ?? null,
  });

  return (
    <>
      <AuthBrandingShellStyles branding={branding} />
      <LoginBrandingBootstrap branding={branding}>
        <LoginPageClient />
      </LoginBrandingBootstrap>
    </>
  );
}
