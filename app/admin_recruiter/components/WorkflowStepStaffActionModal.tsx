"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, readableTextOnBrand } from "@/lib/tenant/tenant-branding";
import {
  STAFF_REVIEW_NOTE_MAX_LENGTH,
  type StaffStepAction,
} from "@/lib/onboarding/staff-step-review-shared";

const COPY: Record<
  StaffStepAction,
  { title: (step: string) => string; description: string; confirm: string; confirmClass: string }
> = {
  complete: {
    title: (step) => `Complete ${step}?`,
    description:
      "This marks the step as completed by you. If it was the only thing blocking the candidate, their next application step unlocks.",
    confirm: "Mark complete",
    confirmClass: "shadow-sm hover:brightness-[0.97]",
  },
  reject: {
    title: (step) => `Reject ${step}?`,
    description:
      "The step is marked as rejected and the candidate stays blocked at it. Add the reason for the record.",
    confirm: "Reject step",
    confirmClass: "bg-red-600 text-white hover:bg-red-700",
  },
  reopen: {
    title: (step) => `Reopen ${step}?`,
    description:
      "The step goes back to Not Started. The candidate is blocked again until someone completes it.",
    confirm: "Reopen step",
    confirmClass: "bg-slate-800 text-white hover:bg-slate-900",
  },
};

export default function WorkflowStepStaffActionModal({
  action,
  stepTitle,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  action: StaffStepAction | null;
  stepTitle: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (input: { note: string; notifyCandidate: boolean }) => void;
}) {
  const branding = useTenantBranding();
  const [note, setNote] = useState("");
  const [notifyCandidate, setNotifyCandidate] = useState(true);

  // Portal content sits outside the branding wrapper, so re-declare the tenant palette here.
  const brandStyle = useMemo(
    () => ({
      ...brandingToCssVars(branding),
      "--step-modal-cta": `linear-gradient(90deg, ${branding.primaryHex} 0%, color-mix(in srgb, ${branding.primaryHex} 74%, white) 100%)`,
      "--step-modal-on-primary": readableTextOnBrand(branding.primaryHex),
      "--step-modal-on-secondary": readableTextOnBrand(branding.secondaryHex),
    }) as React.CSSProperties,
    [branding]
  );

  useEffect(() => {
    if (!action) return;
    setNote("");
    setNotifyCandidate(true);
  }, [action]);

  const copy = action ? COPY[action] : null;
  const noteRequired = action === "reject";
  const canSubmit = !submitting && (!noteRequired || note.trim().length > 0);

  return (
    <Dialog.Root
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open && !submitting) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/40" />
        <Dialog.Content
          style={brandStyle}
          className="fixed left-1/2 top-1/2 z-[111] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-2xl outline-none"
          aria-describedby="workflow-step-staff-action-desc"
        >
          {copy ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSubmit) return;
                onConfirm({ note: note.trim(), notifyCandidate: action === "complete" && notifyCandidate });
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title
                  className="text-base font-semibold"
                  style={{ color: "var(--brand-secondary)" }}
                >
                  {copy.title(stepTitle)}
                </Dialog.Title>
                <Dialog.Close
                  disabled={submitting}
                  style={{
                    backgroundColor: "var(--brand-secondary)",
                    color: "var(--step-modal-on-secondary)",
                  }}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Dialog.Close>
              </div>
              <Dialog.Description id="workflow-step-staff-action-desc" className="mt-1 text-sm text-slate-600">
                {copy.description}
              </Dialog.Description>

              <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="workflow-step-staff-note">
                {noteRequired ? "Reason (required)" : "Note (optional)"}
              </label>
              <textarea
                id="workflow-step-staff-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={STAFF_REVIEW_NOTE_MAX_LENGTH}
                rows={4}
                disabled={submitting}
                placeholder={
                  noteRequired
                    ? "Why is this step rejected?"
                    : "Screening outcome, call summary, or anything the team should know"
                }
                className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-primary)]"
              />

              {action === "complete" ? (
                <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={notifyCandidate}
                    onChange={(event) => setNotifyCandidate(event.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 size-4 accent-[color:var(--brand-primary)]"
                  />
                  <span>
                    Email the candidate a link to their next step
                    <span className="block text-xs text-slate-500">
                      Sent to the candidate only, and only if completing this step unlocks a step they
                      need to fill in.
                    </span>
                  </span>
                </label>
              ) : null}

              {error ? (
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={
                    action === "complete"
                      ? {
                          background: "var(--step-modal-cta)",
                          color: "var(--step-modal-on-primary)",
                        }
                      : undefined
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${copy.confirmClass}`}
                >
                  {submitting ? "Saving…" : copy.confirm}
                </button>
              </div>
            </form>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
