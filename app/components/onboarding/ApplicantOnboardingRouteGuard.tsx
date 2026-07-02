"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import { useApplicantSession } from "@/lib/onboarding/applicant-session-context";
import { resolveApplicantOnboardingRoute } from "@/lib/onboarding/resolve-applicant-onboarding-route";
import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";
import { useOnboardingTenant } from "@/lib/tenant/use-onboarding-tenant";

function OnboardingRouteGuardInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const { replace } = useOnboardingTenant();
  const onboarding = useOnboardingConfigOptional();
  const { sessionReady, sessionLoading } = useApplicantSession();
  const lastRedirectRef = useRef<string | null>(null);

  const tenantSlug = useMemo(() => {
    const fromQuery = searchParams.get("tenant")?.trim().toLowerCase();
    if (fromQuery && fromQuery.length >= 2) return fromQuery;
    if (typeof window !== "undefined") {
      return resolveClientOnboardingTenantSlug(window.location.search);
    }
    return null;
  }, [searchParams]);

  const isDraftPreview = searchParams.get("preview") === "draft";
  const isApplicantDashboard =
    pathname.startsWith("/application/applicant-dashboard") ||
    pathname.startsWith("/application/home");

  const decision = useMemo(() => {
    if (isApplicantDashboard || !onboarding) {
      return { status: "allow" as const };
    }

    const initialLoad =
      !onboarding.progressHydrated &&
      (onboarding.loadingProgress || onboarding.loadingConfig || sessionLoading || !sessionReady);

    return resolveApplicantOnboardingRoute({
      isLoadingSession: sessionLoading || !sessionReady,
      isLoadingTenant: !tenantSlug && !isDraftPreview,
      isLoadingConfig: onboarding.loadingConfig,
      isLoadingProgress: initialLoad,
      tenantSlug,
      config: onboarding.config,
      progress: onboarding.progress,
      pathname,
      search,
      isDraftPreview,
    });
  }, [
    isApplicantDashboard,
    onboarding,
    sessionLoading,
    sessionReady,
    tenantSlug,
    isDraftPreview,
    pathname,
    search,
  ]);

  useEffect(() => {
    if (decision.status !== "redirect") {
      lastRedirectRef.current = null;
      return;
    }
    if (lastRedirectRef.current === decision.href) return;
    lastRedirectRef.current = decision.href;
    replace(decision.href);
  }, [decision, replace]);

  const showLoading =
    decision.status === "loading" &&
    (!onboarding?.progressHydrated || onboarding.loadingConfig || sessionLoading || !sessionReady);

  if (showLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="mt-4 text-sm text-slate-600">Loading your onboarding progress…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Waits for session, tenant, config, and progress before redirecting applicants. */
export default function ApplicantOnboardingRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingRouteGuardInner>{children}</OnboardingRouteGuardInner>;
}
