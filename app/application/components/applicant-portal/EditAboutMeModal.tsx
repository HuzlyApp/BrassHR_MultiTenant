"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WORKER_BTN_OUTLINE, WORKER_BTN_PRIMARY } from "./worker-portal-buttons";

const ABOUT_ME_MAX_LENGTH = 1000;

type EditAboutMeModalProps = {
  open: boolean;
  initialAboutMe: string;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

export function EditAboutMeModal({
  open,
  initialAboutMe,
  onClose,
  onSaved,
}: EditAboutMeModalProps) {
  const { authHeaders } = useApplicantPortal();
  const [aboutMe, setAboutMe] = useState(initialAboutMe);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSaving(false);
      return;
    }
    setAboutMe(initialAboutMe);
  }, [initialAboutMe, open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = aboutMe.trim();
    if (!trimmed) {
      toast.error("Enter a short About Me description");
      return;
    }
    if (trimmed.length > ABOUT_ME_MAX_LENGTH) {
      toast.error(`About Me must be ${ABOUT_ME_MAX_LENGTH} characters or fewer`);
      return;
    }

    setSaving(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/about-me", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ aboutMe: trimmed }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not save About Me");
      toast.success("About Me updated");
      await onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save About Me");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1F2937]">Edit About Me</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close edit about me modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="px-6 py-5">
          <label htmlFor="worker-about-me" className="block text-sm font-medium text-[#374151]">
            About Me
          </label>
          <textarea
            id="worker-about-me"
            value={aboutMe}
            onChange={(event) => setAboutMe(event.target.value)}
            rows={6}
            maxLength={ABOUT_ME_MAX_LENGTH}
            placeholder="Share a short summary of your experience and strengths."
            className="mt-2 w-full resize-y rounded-lg border border-[#D1D5DB] px-4 py-3 text-sm leading-6 text-[#111827] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
            autoFocus
          />
          <p className="mt-1.5 text-right text-xs text-[#9CA3AF]">
            {aboutMe.trim().length}/{ABOUT_ME_MAX_LENGTH}
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className={WORKER_BTN_OUTLINE}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`${WORKER_BTN_PRIMARY} disabled:opacity-60`}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
