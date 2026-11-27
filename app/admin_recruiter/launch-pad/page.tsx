"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { LaunchPadCompleteModal } from "./LaunchPadCompleteModal";
import { ADMIN_LAUNCH_PAD_ROUTE } from "@/lib/signup/smb-post-signup";
import {
  isLaunchPadStepId,
  type LaunchPadStepId,
} from "./constants";
import { LaunchPadChecklist } from "./LaunchPadChecklist";
import { LaunchPadInterests } from "./LaunchPadInterests";
import type { SignupInterests } from "@/lib/signup/signup-interests";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";
import { withTenant } from "@/lib/tenant/with-tenant";
import { clearOnboardingTenantSlugCookie, resolveClientTenantHost } from "@/lib/tenant/resolve-tenant-context";
import { LaunchPadStepHeader } from "./LaunchPadStepHeader";
import {
  countCompletedSteps,
  emptyLaunchPadProgress,
  syncLaunchPadProgress,
  type LaunchPadProgress,
} from "./progress";
import { BrandingStepPanel } from "./steps/BrandingStepPanel";
import { DomainStepPanel } from "./steps/DomainStepPanel";
import { InviteStepPanel } from "./steps/InviteStepPanel";
import { LogoStepPanel } from "./steps/LogoStepPanel";
import { OrgDetailsStepPanel } from "./steps/OrgDetailsStepPanel";
import { PreviewStepPanel } from "./steps/PreviewStepPanel";

function LaunchPadContent() {
  const router = useRouter();
  const { organization, loading: accountLoading, error: accountError } = useAccountData();
  const tenantId = organization?.id;
  const [showComplete, setShowComplete] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [savingProgress, setSavingProgress] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [interests, setInterests] = useState<SignupInterests | null>(null);
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const activeStep = isLaunchPadStepId(stepParam) ? stepParam : null;

  const [progress, setProgress] = useState<LaunchPadProgress>(emptyLaunchPadProgress);

  useEffect(() => {
    let cancelled = false;
    setProgress(emptyLaunchPadProgress());
    setShowComplete(false);
    setLoadingProgress(true);
    setProgressError(null);
    setAccessDenied(false);
    setInterests(null);
    if (!tenantId) {
      if (!accountLoading) {
        setLoadingProgress(false);
        setProgressError(
          accountError ?? "Could not resolve your organization. Try reloading this page.",
        );
      }
      return () => { cancelled = true; };
    }
    const loadInterests = async () => {
      const response = await fetch("/api/admin/launch-pad/interests", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const data = await response.json() as { tenantId?: string; interests?: SignupInterests; error?: string };
      if (response.status === 403 && !cancelled) setAccessDenied(true);
      if (!response.ok || data.tenantId !== tenantId || !data.interests) throw new Error(data.error ?? "Could not load your signup interests.");
      return data.interests;
    };
    void Promise.all([syncLaunchPadProgress(tenantId), loadInterests()]).then(([saved, savedInterests]) => {
      if (cancelled) return;
      setProgress(saved);
      setInterests(savedInterests);
      setShowComplete(countCompletedSteps(saved) === Object.keys(saved).length);
    }).catch((error: unknown) => {
      if (!cancelled) setProgressError(error instanceof Error ? error.message : "Could not load Launch Pad progress.");
    }).finally(() => {
      if (!cancelled) setLoadingProgress(false);
    });
    return () => { cancelled = true; };
  }, [tenantId, loadAttempt, accountLoading, accountError]);

  const openStep = (id: LaunchPadStepId) => {
    router.push(withTenant(`${ADMIN_LAUNCH_PAD_ROUTE}?step=${id}`, searchParams.get("tenant")));
  };

  const backToMain = () => {
    router.push(withTenant(ADMIN_LAUNCH_PAD_ROUTE, searchParams.get("tenant")));
  };

  const completeStep = async (id: LaunchPadStepId) => {
    if (!tenantId || savingProgress) return;
    setSavingProgress(true);
    setProgressError(null);
    try {
      // Saving the domain already records that task on the server.
      const next = await syncLaunchPadProgress(tenantId, id === "domain" ? undefined : id);
      setProgress(next);
      if (countCompletedSteps(next) === Object.keys(next).length) setShowComplete(true);
      backToMain();
    } catch (error) {
      setProgressError(error instanceof Error ? error.message : "Could not save Launch Pad progress.");
    } finally {
      setSavingProgress(false);
    }
  };

  // Deferring a task never satisfies the domain-activation requirement.
  const skipStep = backToMain;

  if (loadingProgress) return <p role="status" className="p-8 text-sm">Loading Launch Pad progress…</p>;
  if (progressError && (!activeStep || !interests)) return (
    <div className="p-8">
      <p role="alert">{progressError}</p>
      {accessDenied ? (
        <>
          <p className="mt-2 text-sm">The selected workspace may differ from your account organization. Launch Pad requires administrator access in the selected workspace.</p>
          {!searchParams.get("tenant") && !resolveClientTenantHost().subdomainLabel ? (
            <button type="button" className="mr-4 mt-3 underline" onClick={() => {
              clearOnboardingTenantSlugCookie();
              window.location.assign(ADMIN_LAUNCH_PAD_ROUTE);
            }}>Return to my organization</button>
          ) : null}
        </>
      ) : null}
      <button type="button" className="mt-3 underline" onClick={() => setLoadAttempt((value) => value + 1)}>Try again</button>
    </div>
  );

  if (!interests?.answeredAt && tenantId) return (
    <LaunchPadInterests
      key={tenantId}
      tenantId={tenantId}
      initialKeys={interests?.keys}
      onBack={() => router.push(withTenant(ADMIN_RECRUITER_HOME_ROUTE, searchParams.get("tenant")))}
      onComplete={(savedInterests) => { setInterests(savedInterests); backToMain(); }}
    />
  );

  if (!activeStep) {
    return (
      <div className="flex min-h-full w-full flex-col bg-[#F4F4F4]">
        <LaunchPadChecklist progress={progress} onOpenStep={openStep} />
        <LaunchPadCompleteModal open={showComplete} onOpenChange={setShowComplete} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-[#F4F4F4]">
      <div className="flex w-full flex-col gap-6 p-[30px]">
        <LaunchPadStepHeader stepId={activeStep} progress={progress} onBack={backToMain} />
        {progressError ? <p role="alert" className="text-sm text-red-600">{progressError}</p> : null}
        <fieldset disabled={savingProgress} className="min-w-0">

        {activeStep === "logo" ? (
          <LogoStepPanel
            onBack={backToMain}
            onSkip={skipStep}
            onComplete={() => completeStep("logo")}
          />
        ) : null}
        {activeStep === "branding" ? (
          <BrandingStepPanel
            onBack={backToMain}
            onSkip={skipStep}
            onComplete={() => completeStep("branding")}
          />
        ) : null}
        {activeStep === "domain" ? (
          <DomainStepPanel
            onBack={backToMain}
            onSkip={skipStep}
            onComplete={() => { void completeStep("domain"); }}
          />
        ) : null}
        {activeStep === "preview" ? (
          <PreviewStepPanel
            onBack={backToMain}
            onSkip={skipStep}
            onComplete={() => completeStep("preview")}
          />
        ) : null}
        {activeStep === "invite" ? (
          <InviteStepPanel
            onBack={backToMain}
            onSkip={skipStep}
            onComplete={() => completeStep("invite")}
          />
        ) : null}
        {activeStep === "organization" ? (
          <OrgDetailsStepPanel
            onBack={backToMain}
            onSkip={skipStep}
            onComplete={() => completeStep("organization")}
          />
        ) : null}
        </fieldset>
      </div>
    </div>
  );
}

export default function LaunchPadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full w-full items-center justify-center bg-[#F4F4F4] p-10 text-sm text-[#6B7280]">
          Loading Launch Pad…
        </div>
      }
    >
      <LaunchPadContent />
    </Suspense>
  );
}
