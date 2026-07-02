"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { FirmaSigningIframe } from "@/app/components/onboarding/FirmaSigningIframe";
import {
  isFirmaSigningComplete,
  normalizeFirmaSigningStatus,
  stepUsesFirmaSigning,
} from "@/lib/onboarding/firma-step-settings";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

type FirmaSessionResponse = {
  session?: {
    signing_request_id: string;
    iframe_url: string | null;
    firma_status: string;
  };
  error?: string;
  code?: string;
};

type Props = {
  applicantId: string | null;
  step: TenantOnboardingStep | null;
  tenantSlug?: string | null;
  signerEmail: string;
  agreed: boolean;
  configLoading?: boolean;
  onSignedChange?: (signed: boolean) => void;
};

function mapFirmaStatusLabel(status: string): string {
  const normalized = normalizeFirmaSigningStatus(status);
  switch (normalized) {
    case "completed":
    case "signed":
      return "Signed";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "expired":
      return "Expired";
    case "cancelled":
    case "voided":
      return "Cancelled";
    default:
      return "Pending";
  }
}

export function AuthorizationsFirmaAgreementPanel({
  applicantId,
  step,
  tenantSlug,
  signerEmail,
  agreed,
  configLoading = false,
  onSignedChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [signingRequestId, setSigningRequestId] = useState<string | null>(null);
  const [firmaStatus, setFirmaStatus] = useState("draft");
  const [showSigningModal, setShowSigningModal] = useState(false);

  const stepKey = step?.step_key ?? "";
  const stepId = step?.id ?? "";
  const hasFirmaTemplate = step ? stepUsesFirmaSigning(step) : false;
  const emailValid = isDeliverableApplicantEmail(signerEmail);
  const signed = isFirmaSigningComplete(firmaStatus);

  useEffect(() => {
    onSignedChange?.(signed);
  }, [signed, onSignedChange]);

  useEffect(() => {
    if (!applicantId || !stepKey || !hasFirmaTemplate || !emailValid) return;

    const activeApplicantId = applicantId;
    const activeStepKey = stepKey;

    let cancelled = false;

    async function loadExistingSession() {
      try {
        const query = new URLSearchParams({
          applicantId: activeApplicantId,
          stepKey: activeStepKey,
        });
        if (stepId) query.set("stepId", stepId);
        if (tenantSlug) query.set("tenantSlug", tenantSlug);

        const res = await fetch(`/api/onboarding/firma-sign/status?${query.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as FirmaSessionResponse;
        const session = data.session;
        if (!session || cancelled) return;

        setSigningRequestId(session.signing_request_id ?? null);
        setFirmaStatus(session.firma_status ?? "draft");
        if (session.iframe_url) {
          setIframeUrl(session.iframe_url);
        }
      } catch {
        /* no existing session yet */
      }
    }

    void loadExistingSession();
    return () => {
      cancelled = true;
    };
  }, [applicantId, stepKey, stepId, tenantSlug, hasFirmaTemplate, emailValid]);

  const refreshStatus = useCallback(async () => {
    if (!applicantId || !stepKey || !signingRequestId) return;
    const activeApplicantId = applicantId;
    const activeStepKey = stepKey;
    try {
      const query = new URLSearchParams({
        applicantId: activeApplicantId,
        stepKey: activeStepKey,
      });
      if (stepId) query.set("stepId", stepId);
      if (tenantSlug) query.set("tenantSlug", tenantSlug);
      const res = await fetch(`/api/onboarding/firma-sign/status?${query.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as FirmaSessionResponse & { completed?: boolean };
      if (!res.ok) return;
      const status = data.session?.firma_status ?? firmaStatus;
      setFirmaStatus(status);
      if (data.session?.signing_request_id) {
        setSigningRequestId(data.session.signing_request_id);
      }
      if (data.completed) {
        setShowSigningModal(false);
      }
    } catch {
      /* ignore polling errors */
    }
  }, [applicantId, stepKey, stepId, tenantSlug, signingRequestId, firmaStatus]);

  useEffect(() => {
    if (!signingRequestId || !applicantId || !stepKey) return;
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [signingRequestId, applicantId, stepKey, refreshStatus]);

  const startFirmaSigning = useCallback(async () => {
    if (!agreed) {
      setError("Please agree to the authorization first.");
      return;
    }
    if (!emailValid) {
      setError("A valid applicant email is required. Complete the first onboarding step with your email address.");
      return;
    }
    if (!applicantId || !stepKey) {
      setError("Missing applicant session. Return to the first onboarding step.");
      return;
    }
    const activeApplicantId = applicantId;
    const activeStepKey = stepKey;
    if (!hasFirmaTemplate) {
      setError("Agreement signing is not configured. Ask your recruiter to attach a Firma template to this step.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        applicantId: activeApplicantId,
        stepKey: activeStepKey,
      });
      if (stepId) query.set("stepId", stepId);
      if (tenantSlug) query.set("tenantSlug", tenantSlug);

      const res = await fetch(`/api/onboarding/firma-sign/session?${query.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as FirmaSessionResponse;
      if (!res.ok) {
        throw new Error(data.error || "Could not start Firma signing");
      }

      const session = data.session;
      setSigningRequestId(session?.signing_request_id ?? null);
      setFirmaStatus(session?.firma_status ?? "draft");
      setIframeUrl(session?.iframe_url ?? null);

      if (session?.iframe_url) {
        setShowSigningModal(true);
      } else {
        throw new Error("Firma did not return a signing link for this applicant.");
      }

      if (session?.signing_request_id) {
        localStorage.setItem("signingRequestId", session.signing_request_id);
      }
      localStorage.setItem("signingStatus", normalizeFirmaSigningStatus(session?.firma_status));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signing setup failed");
    } finally {
      setLoading(false);
    }
  }, [
    agreed,
    applicantId,
    emailValid,
    hasFirmaTemplate,
    stepId,
    stepKey,
    tenantSlug,
  ]);

  if (configLoading) {
    return (
      <div className="mb-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        Loading agreement signing configuration…
      </div>
    );
  }

  if (!hasFirmaTemplate) {
    return (
      <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Agreement e-signing is not configured for this onboarding step. Your recruiter must attach a
        Firma template in the onboarding builder before applicants can sign.
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-3xl border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/5 p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)]">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Onboarding Agreement</p>
            <p className="text-xs text-slate-500">Mandatory · Firma e-sign</p>
          </div>
        </div>

        {!signed && (
          <button
            type="button"
            onClick={() => void startFirmaSigning()}
            disabled={loading || !agreed || !emailValid}
            className={`rounded-xl px-5 py-2 text-[12px] font-semibold text-white transition ${
              loading || !agreed || !emailValid
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[color:var(--brand-primary)] hover:brightness-90"
            }`}
          >
            {loading ? "Preparing..." : "Click and Sign"}
          </button>
        )}

        {signed ? (
          <span className="rounded-xl bg-[color:var(--brand-primary)] px-5 py-2 text-[12px] font-semibold text-white">
            Signed
          </span>
        ) : null}
      </div>

      {signingRequestId ? (
        <p className="mt-4 text-xs text-slate-500 truncate">Signing request: {signingRequestId}</p>
      ) : null}

      <p className="mt-2 text-sm text-slate-700">
        Status: <span className="font-semibold">{mapFirmaStatusLabel(firmaStatus)}</span>
      </p>

      {!emailValid ? (
        <p className="mt-2 text-sm text-rose-600">
          Enter a valid email on the first onboarding step before signing the agreement.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {showSigningModal && iframeUrl ? (
        <div className="fixed inset-0 z-50 flex bg-black/50 p-0">
          <div className="relative flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-slate-50 shadow-2xl sm:mx-auto sm:max-w-6xl sm:rounded-xl">
            <button
              type="button"
              onClick={() => setShowSigningModal(false)}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-md transition hover:opacity-90"
              aria-label="Close signing modal"
            >
              <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
            <div className="min-h-0 flex-1 overflow-hidden">
              <FirmaSigningIframe iframeUrl={iframeUrl} title="Sign Agreement" variant="modal" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
