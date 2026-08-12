"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock3, Loader2, X } from "lucide-react";
import type { ApplicationPipelinePayload } from "@/lib/applicant-portal/application-pipeline-types";
import { persistApplicationJobContext } from "@/lib/onboarding/client-job-application";

type ApplicationPipelineModalProps = {
  open: boolean;
  applicationId: string | null;
  onClose: () => void;
  authHeaders: () => Promise<Record<string, string> | null>;
};

function stepIcon(status: ApplicationPipelinePayload["steps"][number]["status"]) {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 text-[#16A34A]" aria-hidden />;
  }
  if (status === "in_progress") {
    return <Clock3 className="h-5 w-5 text-[#F97316]" aria-hidden />;
  }
  return <Circle className="h-5 w-5 text-[#CBD5E1]" aria-hidden />;
}

function stepBadgeClass(status: ApplicationPipelinePayload["steps"][number]["status"]): string {
  if (status === "completed") return "bg-[#DCFCE7] text-[#166534]";
  if (status === "in_progress") return "bg-[#FFEDD5] text-[#C2410C]";
  return "bg-[#F1F5F9] text-[#64748B]";
}

export function ApplicationPipelineModal({
  open,
  applicationId,
  onClose,
  authHeaders,
}: ApplicationPipelineModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<ApplicationPipelinePayload | null>(null);

  const loadPipeline = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const res = await fetch(`/api/me/applications/${encodeURIComponent(applicationId)}/pipeline`, {
        headers,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as ApplicationPipelinePayload & {
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load application pipeline.");
      setPipeline(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load application pipeline.");
      setPipeline(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId, authHeaders]);

  useEffect(() => {
    if (!open || !applicationId) return;
    void loadPipeline();
  }, [applicationId, loadPipeline, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  function startIncompleteSteps() {
    if (!pipeline) return;
    persistApplicationJobContext({
      applicationId: pipeline.applicationId,
      jobToken: pipeline.jobToken,
    });
    onClose();
  }

  if (!open) return null;

  const verificationHref = pipeline?.tenantSlug
    ? `/application/application-status?tenant=${encodeURIComponent(pipeline.tenantSlug)}`
    : "/application/application-status";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close application pipeline"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-pipeline-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              Application Pipeline
            </p>
            <h2 id="application-pipeline-title" className="mt-1 text-lg font-semibold text-[#111827]">
              {pipeline?.jobTitle ?? "Job Application"}
            </h2>
            {pipeline?.jobLocation ? (
              <p className="mt-1 text-sm text-[#6B7280]">{pipeline.jobLocation}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] transition hover:bg-[#F9FAFB]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pipeline…
            </div>
          ) : error ? (
            <p className="py-10 text-sm text-[#B91C1C]">{error}</p>
          ) : pipeline ? (
            <div className="space-y-0">
              {pipeline.steps.map((step, index) => {
                const isLast = index === pipeline.steps.length - 1;
                return (
                  <div key={step.id} className="relative flex gap-4 pb-6">
                    {!isLast ? (
                      <span
                        aria-hidden
                        className="absolute left-[10px] top-6 h-[calc(100%-12px)] w-px bg-[#E5E7EB]"
                      />
                    ) : null}
                    <div className="relative z-[1] mt-0.5 shrink-0">{stepIcon(step.status)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#111827]">{step.title}</h3>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stepBadgeClass(step.status)}`}
                        >
                          {step.statusLabel}
                        </span>
                      </div>
                      {step.completedAt ? (
                        <p className="mt-1 text-xs text-[#94A3B8]">
                          Completed{" "}
                          {new Date(step.completedAt).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                      {step.isVerificationStep && step.status === "completed" ? (
                        <p className="mt-2 text-sm text-[#6B7280]">
                          Current verification status:{" "}
                          <span className="font-medium text-[#111827]">
                            {step.statusLabel}
                          </span>
                          .
                        </p>
                      ) : null}
                      {step.isVerificationStep && step.status === "in_progress" ? (
                        <p className="mt-2 text-sm text-[#6B7280]">
                          Your application has been submitted. Current verification status:{" "}
                          <span className="font-medium text-[#111827]">
                            {pipeline.workerVerificationLabel}
                          </span>
                          .
                        </p>
                      ) : null}
                      {step.isVerificationStep && step.status === "pending" ? (
                        <p className="mt-2 text-sm text-[#6B7280]">
                          Complete the remaining steps, then click final submit. Status stays Pending
                          until every step is finished.
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {pipeline ? (
          <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                  Overall Status
                </p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">{pipeline.statusLabel}</p>
              </div>
              {pipeline.firstIncompleteStepHref ? (
                <Link
                  href={pipeline.firstIncompleteStepHref}
                  onClick={startIncompleteSteps}
                  className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#FDBA74] bg-[#C2410C] px-4 text-sm font-semibold text-white transition hover:bg-[#9A3412]"
                >
                  Complete Step
                </Link>
              ) : (
                <Link
                  href={verificationHref}
                  onClick={onClose}
                  className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm font-medium text-[#374151] transition hover:bg-[#F9FAFB]"
                >
                  View Verification Status
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
