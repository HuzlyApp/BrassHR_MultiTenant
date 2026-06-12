"use client";

import type { DocumentReviewStatus } from "@/lib/admin/document-review";

type DocumentReviewActionsProps = {
  disabled?: boolean;
  loading?: boolean;
  currentStatus?: DocumentReviewStatus | string | null;
  onApprove: () => void;
  onReject: () => void;
  onRequestMore?: () => void;
  requestMoreLabel?: string;
  showRequestEsign?: boolean;
  onRequestEsign?: () => void;
  esignLoading?: boolean;
};

function actionClass(active: boolean, enabled: boolean): string {
  const base = "inline-flex h-8 items-center justify-center rounded-md px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  if (!enabled) {
    return `${base} border border-[#E5E7EB] bg-[#E5E7EB] text-[#9CA3AF]`;
  }
  if (active) {
    return `${base} bg-[color:var(--brand-primary)] text-white`;
  }
  return `${base} border border-[color:color-mix(in_srgb,var(--brand-primary)_30%,white)] text-[color:var(--brand-primary)] hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]`;
}

export default function DocumentReviewActions({
  disabled = false,
  loading = false,
  currentStatus,
  onApprove,
  onReject,
  onRequestMore,
  requestMoreLabel = "Request More",
  showRequestEsign = false,
  onRequestEsign,
  esignLoading = false,
}: DocumentReviewActionsProps) {
  const enabled = !disabled && !loading;
  const status = currentStatus ?? "uploaded";

  if (status === "approved") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`${actionClass(true, true)} pointer-events-none`}
          aria-label="Document approved"
        >
          Approved
        </span>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`${actionClass(true, true)} pointer-events-none`}
          aria-label="Document rejected"
        >
          Rejected
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!enabled}
        onClick={onApprove}
        className={actionClass(false, enabled)}
      >
        {loading ? "Saving..." : "Approved"}
      </button>
      <button
        type="button"
        disabled={!enabled}
        onClick={onReject}
        className={actionClass(false, enabled)}
      >
        Reject
      </button>
      {onRequestMore ? (
        <button
          type="button"
          disabled={!enabled}
          onClick={onRequestMore}
          className={actionClass(status === "needs_revision", enabled)}
        >
          {requestMoreLabel}
        </button>
      ) : null}
      {showRequestEsign && onRequestEsign ? (
        <button
          type="button"
          disabled={!enabled || esignLoading}
          onClick={onRequestEsign}
          className={actionClass(false, enabled && !esignLoading)}
        >
          {esignLoading ? "Sending..." : "Request eSign"}
        </button>
      ) : null}
    </div>
  );
}
