"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import OnboardingStepper from "@/app/components/OnboardingStepper";
import OnboardingLoader from "@/app/components/OnboardingLoader";
import { FirmaSigningIframe } from "@/app/components/onboarding/FirmaSigningIframe";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav";
import { ensureApplicantWorker } from "@/lib/onboarding/ensure-applicant-worker";
import { isDraftPreviewApplicantId, isOnboardingDraftPreview } from "@/lib/onboarding/is-draft-preview";
import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";

type FirmaSessionResponse = {
  session?: {
    signing_request_id: string;
    iframe_url: string | null;
    firma_status: string;
    onboarding_status: string;
    step_title: string;
  };
  error?: string;
  code?: string;
};

function getApplicantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("applicantId")?.trim() || null;
}

export default function FirmaSignPage() {
  const branding = useTenantBranding();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const nav = useOnboardingStepNav();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null);
  const [firmaStatus, setFirmaStatus] = useState<string>("draft");
  const [continuing, setContinuing] = useState(false);

  const stepKey = nav.currentStep?.step_key ?? searchParams.get("stepKey")?.trim() ?? "";
  const stepId = nav.currentStep?.id ?? searchParams.get("stepId")?.trim() ?? "";

  useEffect(() => {
    if (nav.configLoading) return;

    let cancelled = false;

    async function bootstrapSigningSession() {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      const applicantId = getApplicantId();
      if (!applicantId || !stepKey) {
        setError("Missing applicant or onboarding step context.");
        setLoading(false);
        return;
      }

      const isPreview =
        isOnboardingDraftPreview(search) || isDraftPreviewApplicantId(applicantId);

      if (!isPreview) {
        const ensured = await ensureApplicantWorker();
        if (!ensured.ok) {
          if (!cancelled) {
            setError(ensured.error);
            setLoading(false);
          }
          return;
        }
      }

      const tenantSlug =
        nav.slug?.trim() ||
        resolveClientOnboardingTenantSlug(search) ||
        searchParams.get("tenant")?.trim() ||
        "";

      try {
        const query = new URLSearchParams({
          applicantId,
          stepKey,
        });
        if (stepId) query.set("stepId", stepId);
        if (tenantSlug) query.set("tenantSlug", tenantSlug);
        if (isPreview) query.set("preview", "draft");

        const res = await fetch(`/api/onboarding/firma-sign/session?${query.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as FirmaSessionResponse & { code?: string };
        if (!res.ok) {
          const err = new Error(data.error || "Could not start Firma signing") as Error & {
            code?: string;
          };
          err.code = data.code;
          throw err;
        }
        if (cancelled) return;
        setIframeUrl(data.session?.iframe_url ?? null);
        setSigningRequestId(data.session?.signing_request_id ?? null);
        setFirmaStatus(data.session?.firma_status ?? "draft");
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not start Firma signing");
        setErrorCode((err as Error & { code?: string }).code ?? null);
        setIframeUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrapSigningSession();
    return () => {
      cancelled = true;
    };
  }, [nav.configLoading, nav.slug, search, searchParams, stepKey, stepId]);

  useEffect(() => {
    const applicantId = getApplicantId();
    if (!applicantId || !stepKey || !signingRequestId || loading || error) return;

    const isPreview =
      isOnboardingDraftPreview(search) || isDraftPreviewApplicantId(applicantId);

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const tenantSlug =
            nav.slug?.trim() ||
            resolveClientOnboardingTenantSlug(search) ||
            searchParams.get("tenant")?.trim() ||
            "";
          const query = new URLSearchParams({ applicantId, stepKey });
          if (stepId) query.set("stepId", stepId);
          if (tenantSlug) query.set("tenantSlug", tenantSlug);
          if (isPreview) query.set("preview", "draft");
          const res = await fetch(`/api/onboarding/firma-sign/status?${query.toString()}`, {
            cache: "no-store",
          });
          const data = await res.json();
          if (!res.ok) return;
          setFirmaStatus(data.session?.firma_status ?? firmaStatus);
        } catch {
          /* ignore polling errors */
        }
      })();
    }, 8000);

    return () => window.clearInterval(interval);
  }, [stepKey, stepId, signingRequestId, loading, error, firmaStatus, nav.slug, search, searchParams]);

  async function handleContinue() {
    const applicantId = getApplicantId();
    if (!applicantId || !stepKey) return;

    setContinuing(true);
    setError(null);
    try {
      const isPreview =
        isOnboardingDraftPreview(search) || isDraftPreviewApplicantId(applicantId);
      const tenantSlug =
        nav.slug?.trim() ||
        resolveClientOnboardingTenantSlug(search) ||
        searchParams.get("tenant")?.trim() ||
        "";
      const statusQuery = new URLSearchParams({ applicantId, stepKey });
      if (stepId) statusQuery.set("stepId", stepId);
      if (tenantSlug) statusQuery.set("tenantSlug", tenantSlug);
      if (isPreview) statusQuery.set("preview", "draft");

      const statusRes = await fetch(`/api/onboarding/firma-sign/status?${statusQuery.toString()}`, {
        cache: "no-store",
      });
      const statusData = await statusRes.json();
      if (!statusRes.ok) {
        throw new Error(statusData.error || "Could not verify signing status");
      }

      setFirmaStatus(statusData.session?.firma_status ?? firmaStatus);

      const progressStatus = statusData.completed ? "completed" : "in_progress";
      await fetch("/api/onboarding/progress/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          stepKey,
          status: progressStatus,
          data: {
            signing_provider: "firma",
            signing_request_id: statusData.session?.signing_request_id ?? signingRequestId,
            firma_status: statusData.session?.firma_status ?? firmaStatus,
          },
        }),
      });

      if (!statusData.completed) {
        setError("Please finish signing the document before continuing.");
        return;
      }

      if (nav.nextRoute) {
        nav.push(nav.nextRoute);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not continue onboarding");
    } finally {
      setContinuing(false);
    }
  }

  if (nav.configLoading || loading) {
    return <OnboardingLoader label="Loading document signing..." />;
  }

  const stepTitle = nav.currentStep?.title ?? "Document Signing";

  return (
    <OnboardingLayout style={brandingToCssVars(branding)}>
      <OnboardingStepper />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#101828]">{stepTitle}</h1>
          <p className="mt-2 text-sm text-[#667085]">
            Review and sign your document below. You can complete signing without leaving onboarding.
          </p>
          {signingRequestId ? (
            <p className="mt-1 text-xs text-[#98a2b3]">Signing request: {signingRequestId}</p>
          ) : null}
          <p className="mt-1 text-xs font-medium text-[#475467]">Status: {firmaStatus}</p>
        </div>

        {error ? (
          <div
            data-testid="firma-signing-error"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
            {errorCode ? <span className="mt-1 block text-xs text-red-600">Code: {errorCode}</span> : null}
          </div>
        ) : null}

        <FirmaSigningIframe iframeUrl={iframeUrl} title={stepTitle} />

        <div className="mt-6 flex items-center justify-end gap-3">
          {nav.prevRoute ? (
            <button
              type="button"
              onClick={() => nav.push(nav.prevRoute!)}
              className="rounded-lg border border-[#d0d5dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054]"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            data-testid="firma-signing-continue"
            onClick={() => void handleContinue()}
            disabled={continuing || !iframeUrl}
            className="rounded-lg bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {continuing ? "Checking signature..." : "Continue"}
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
