"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import { useApplicantSession } from "@/lib/onboarding/applicant-session-context";
import { searchHasJobToken } from "@/lib/onboarding/applicant-job-application-context";
import { resolveApplicantOnboardingRoute } from "@/lib/onboarding/resolve-applicant-onboarding-route";
import { resolveApplicantEnabledSteps } from "@/lib/onboarding/tenant-step-navigation";
import { useAutoSkipNonNavigableApplicantSteps } from "@/lib/onboarding/use-auto-skip-non-navigable-steps";
import {
  readJobTokenFromSearch,
  useJobApplicationAlreadySubmitted,
} from "@/lib/onboarding/use-job-application-already-submitted";
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

  const jobToken = useMemo(() => readJobTokenFromSearch(search), [search]);
  const shouldCheckJobApplication =
    !isApplicantDashboard &&
    !isDraftPreview &&
    Boolean(jobToken) &&
    searchHasJobToken(search);

  const jobApplicationAlreadySubmitted = useJobApplicationAlreadySubmitted({
    jobToken,
    tenantSlug,
    sessionReady,
    enabled: shouldCheckJobApplication,
    recheckKey: onboarding?.progress?.submittedAt ?? null,
  });

  const enabledSteps = useMemo(
    () => resolveApplicantEnabledSteps(onboarding?.config ?? null, onboarding?.loadingConfig ?? true),
    [onboarding?.config, onboarding?.loadingConfig]
  );

  useAutoSkipNonNavigableApplicantSteps(
    enabledSteps,
    onboarding?.progress ?? null,
    onboarding?.updateStepStatus
  );

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
      // Keep the current screen mounted while a background refresh reloads config.
      isLoadingConfig: onboarding.loadingConfig && !onboarding.config,
      isLoadingProgress: initialLoad,
      tenantSlug,
      config: onboarding.config,
      progress: onboarding.progress,
      pathname,
      search,
      isDraftPreview,
      jobApplicationAlreadySubmitted: shouldCheckJobApplication
        ? jobApplicationAlreadySubmitted
        : null,
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
    shouldCheckJobApplication,
    jobApplicationAlreadySubmitted,
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
    (!onboarding?.progressHydrated ||
      onboarding.loadingConfig ||
      sessionLoading ||
      !sessionReady ||
      (shouldCheckJobApplication && jobApplicationAlreadySubmitted === null));

  if (showLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          <p className="mt-5 text-lg font-medium text-slate-700">
            {onboarding?.workflowPhase === "post_hire"
              ? "Loading your onboarding…"
              : "Loading the Application Steps...."}
          </p>
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
