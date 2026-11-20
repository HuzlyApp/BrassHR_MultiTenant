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
import { LaunchPadStepHeader } from "./LaunchPadStepHeader";
import {
  countCompletedSteps,
  emptyLaunchPadProgress,
  markLaunchPadStepComplete,
  readLaunchPadProgress,
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
  const { organization } = useAccountData();
  const tenantId = organization?.id;
  const [showComplete, setShowComplete] = useState(false);
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const activeStep = isLaunchPadStepId(stepParam) ? stepParam : null;

  const [progress, setProgress] = useState<LaunchPadProgress>(emptyLaunchPadProgress);

  useEffect(() => {
    const saved = tenantId ? readLaunchPadProgress(tenantId) : emptyLaunchPadProgress();
    setProgress(saved);
    setShowComplete(countCompletedSteps(saved) === Object.keys(saved).length);
  }, [tenantId]);

  const openStep = (id: LaunchPadStepId) => {
    router.push(`${ADMIN_LAUNCH_PAD_ROUTE}?step=${id}`);
  };

  const backToMain = () => {
    router.push(ADMIN_LAUNCH_PAD_ROUTE);
  };

  const completeStep = (id: LaunchPadStepId) => {
    if (!tenantId) return;
    const next = markLaunchPadStepComplete(tenantId, id, true);
    setProgress(next);
    if (countCompletedSteps(next) === Object.keys(next).length) setShowComplete(true);
    backToMain();
  };

  const skipStep = () => {
    // Optional steps can be reviewed later; the workspace address must be confirmed.
    if (activeStep && activeStep !== "domain") completeStep(activeStep);
    else backToMain();
  };

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
            onComplete={() => completeStep("domain")}
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
