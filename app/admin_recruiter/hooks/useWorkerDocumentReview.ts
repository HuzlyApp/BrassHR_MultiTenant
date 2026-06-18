"use client";

import { useCallback, useState } from "react";
import type { DocumentReviewStatus, AgreementSectionId } from "@/lib/admin/document-review";

type ReviewTarget = {
  submittedDocumentId?: string | null;
  legacyDocumentKey?: string | null;
};

type AgreementUploadRequest = {
  section: AgreementSectionId;
  title: string;
  submittedDocumentId?: string | null;
  legacyDocumentKey?: string | null;
  message?: string;
};

export function useWorkerDocumentReview(workerId: string | undefined, onSuccess?: () => void) {
  const [reviewLoadingKey, setReviewLoadingKey] = useState<string | null>(null);
  const [esignLoading, setEsignLoading] = useState(false);
  const [uploadRequestLoadingKey, setUploadRequestLoadingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reviewKey = (target: ReviewTarget) =>
    target.submittedDocumentId
      ? `submitted:${target.submittedDocumentId}`
      : `legacy:${target.legacyDocumentKey ?? "unknown"}`;

  const submitReview = useCallback(
    async (target: ReviewTarget, status: DocumentReviewStatus, reviewNotes?: string) => {
      if (!workerId) return;
      const key = reviewKey(target);
      setReviewLoadingKey(key);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/worker-document-review", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerId,
            submittedDocumentId: target.submittedDocumentId ?? undefined,
            legacyDocumentKey: target.legacyDocumentKey ?? undefined,
            status,
            reviewNotes,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to save review");
        await onSuccess?.();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to save review");
      } finally {
        setReviewLoadingKey(null);
      }
    },
    [workerId, onSuccess]
  );

  const requestAgreementUpload = useCallback(
    async (input: AgreementUploadRequest) => {
      if (!workerId) return;
      const key = `upload-request:${input.section}`;
      setUploadRequestLoadingKey(key);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/worker-agreement-upload-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerId,
            section: input.section,
            title: input.title,
            submittedDocumentId: input.submittedDocumentId ?? undefined,
            legacyDocumentKey: input.legacyDocumentKey ?? undefined,
            message: input.message,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to request upload");
        await onSuccess?.();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to request upload");
      } finally {
        setUploadRequestLoadingKey(null);
      }
    },
    [workerId, onSuccess]
  );

  const requestEsign = useCallback(
    async (requestId?: string | null, actionId?: string | null) => {
      if (!workerId) return;
      setEsignLoading(true);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/worker-request-esign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerId,
            requestId: requestId ?? undefined,
            actionId: actionId ?? undefined,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to request eSign");
        await onSuccess?.();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to request eSign");
      } finally {
        setEsignLoading(false);
      }
    },
    [workerId, onSuccess]
  );

  return {
    reviewLoadingKey,
    esignLoading,
    uploadRequestLoadingKey,
    actionError,
    setActionError,
    submitReview,
    requestAgreementUpload,
    requestEsign,
    reviewKey,
    isReviewLoading: (target: ReviewTarget) => reviewLoadingKey === reviewKey(target),
    isUploadRequestLoading: (section: AgreementSectionId) =>
      uploadRequestLoadingKey === `upload-request:${section}`,
  };
}
