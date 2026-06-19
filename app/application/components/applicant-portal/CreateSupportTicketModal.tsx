"use client";

import { FormEvent, useEffect, useState } from "react";
import { Ticket, X } from "lucide-react";
import SuccessModal from "@/app/components/SuccessModal";
import type { SupportTicketPriority } from "@/lib/support-tickets/types";

export type SupportTicketFormValues = {
  subject: string;
  description: string;
  category: string;
  priority: SupportTicketPriority;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultDescription?: string;
  defaultSubject?: string;
  submitEndpoint?: string;
  authHeaders: () => Promise<Record<string, string> | null>;
  onSuccess?: (payload: { ticketId?: string; chatMessage?: unknown }) => void;
};

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "documents", label: "Documents" },
  { value: "onboarding", label: "Onboarding" },
  { value: "technical", label: "Technical" },
];

const PRIORITY_OPTIONS: { value: SupportTicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function CreateSupportTicketModal({
  open,
  onClose,
  defaultDescription = "",
  defaultSubject = "",
  submitEndpoint = "/api/applicant-portal/messages/ai-ticket",
  authHeaders,
  onSuccess,
}: Props) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [errors, setErrors] = useState<{ subject?: string; description?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setDescription(defaultDescription);
    setCategory("general");
    setPriority("normal");
    setErrors({});
    setSubmitError(null);
    setShowSuccess(false);
  }, [open, defaultDescription, defaultSubject]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: { subject?: string; description?: string } = {};
    if (!subject.trim()) nextErrors.subject = "Subject is required.";
    if (!description.trim()) nextErrors.description = "Please describe your request.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const res = await fetch(submitEndpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
          source: "ai_fallback",
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        ticket_id?: string;
        ticket?: { id?: string };
        chatMessage?: unknown;
      };

      if (!res.ok) {
        throw new Error(payload.error || payload.message || "Could not create support ticket.");
      }

      onSuccess?.({
        ticketId: payload.ticket_id ?? payload.ticket?.id,
        chatMessage: payload.chatMessage ?? payload.message,
      });
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create support ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessClose() {
    setShowSuccess(false);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-support-ticket-title"
          className="w-full max-w-[600px] overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-end border-b border-[#E5E7EB] px-3.5 py-3">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white transition hover:brightness-110 disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 pt-4">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F4F4] text-[#012352]">
                <Ticket className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h2 id="create-support-ticket-title" className="text-2xl font-semibold text-[#0F172A]">
                  Create Support Ticket
                </h2>
                <p className="mt-0.5 text-sm text-[#64748B]">
                  Please describe your issue or request. Our support team or recruiter will review it.
                </p>
              </div>
            </div>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            ) : null}

            <div className="grid gap-4 px-2 sm:grid-cols-2">
              <div>
                <label htmlFor="ticket-category" className="mb-1 block text-sm text-[#374151]">
                  Category
                </label>
                <select
                  id="ticket-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary)"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ticket-priority" className="mb-1 block text-sm text-[#374151]">
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}
                  className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary)"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-2">
              <label htmlFor="ticket-subject" className="mb-1 block text-sm text-[#374151]">
                Subject
              </label>
              <input
                id="ticket-subject"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  if (errors.subject) setErrors((current) => ({ ...current, subject: undefined }));
                }}
                placeholder="Subject"
                className={`h-11 w-full rounded-lg border px-3.5 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-(--brand-primary) ${
                  errors.subject ? "border-red-400" : "border-[#CBD5E1]"
                }`}
              />
              {errors.subject ? <p className="mt-1 text-xs text-red-600">{errors.subject}</p> : null}
            </div>

            <div className="px-2">
              <label htmlFor="ticket-description" className="mb-1 block text-sm text-[#374151]">
                Details of request
              </label>
              <textarea
                id="ticket-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (errors.description) setErrors((current) => ({ ...current, description: undefined }));
                }}
                rows={4}
                placeholder="Describe your issue or request"
                className={`min-h-[100px] w-full resize-y rounded-lg border px-3.5 py-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-(--brand-primary) ${
                  errors.description ? "border-red-400" : "border-[#CBD5E1]"
                }`}
              />
              {errors.description ? (
                <p className="mt-1 text-xs text-red-600">{errors.description}</p>
              ) : null}
            </div>

            <div className="flex gap-5 px-2 pb-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-semibold text-[#012352] transition hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                }}
              >
                {submitting ? "Creating..." : "Create Ticket"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SuccessModal
        open={showSuccess}
        onClose={handleSuccessClose}
        title="Success!"
        message="Your support ticket has been created."
      />
    </>
  );
}
