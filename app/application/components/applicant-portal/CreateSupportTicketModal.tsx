"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import SuccessModal from "@/app/components/SuccessModal";
import { TicketFileUploadFields } from "@/app/components/support/TicketFileUploadFields";
import { SUPPORT_DEPARTMENT_CATEGORY_OPTIONS } from "@/lib/support-tickets/support-departments";
import { validateTicketSubjectAndMessage } from "@/lib/support-tickets/ticket-field-validation";
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
  defaultCategory?: string;
  submitEndpoint?: string;
  authHeaders: () => Promise<Record<string, string> | null>;
  onSuccess?: (payload: { ticketId?: string; chatMessage?: unknown }) => void;
  successActionLabel?: string;
  /** Build href for the success CTA from the new ticket id. */
  successActionHrefForTicket?: (ticketId: string) => string;
  onSuccessAction?: (ticketId: string) => void;
};

const CATEGORY_OPTIONS = SUPPORT_DEPARTMENT_CATEGORY_OPTIONS;

const PRIORITY_OPTIONS: { value: SupportTicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-secondary,#012352)]";
const SELECT_CLASS =
  "h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#CBD5E1] bg-white py-2 pl-3.5 pr-11 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-secondary,#012352)]";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[#374151]";

export function CreateSupportTicketModal({
  open,
  onClose,
  defaultDescription = "",
  defaultSubject = "",
  defaultCategory = "general",
  submitEndpoint = "/api/applicant-portal/messages/ai-ticket",
  authHeaders,
  onSuccess,
  successActionLabel,
  successActionHrefForTicket,
  onSuccessAction,
}: Props) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("high");
  const [errors, setErrors] = useState<{
    subject?: string;
    description?: string;
    category?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const wasOpenRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSubject(defaultSubject);
      setDescription(defaultDescription);
      setCategory(defaultCategory || "");
      setPriority("high");
      setErrors({});
      setSubmitError(null);
      setShowSuccess(false);
      setCreatedTicketId(null);
      setSelectedFiles([]);
      setFileUrl("");
      setAttachedUrls([]);
      setUploadResetKey((current) => current + 1);
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open, defaultCategory, defaultDescription, defaultSubject]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !showSuccess) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, submitting, showSuccess]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateTicketSubjectAndMessage({ subject, description });
    const nextErrors: { subject?: string; description?: string; category?: string } = {
      ...fieldErrors,
    };
    if (!category) nextErrors.category = "Select a department.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const descriptionWithUrls =
      attachedUrls.length > 0
        ? `${description.trim()}\n\nAttached file URLs:\n${attachedUrls.map((url) => `- ${url}`).join("\n")}`
        : description.trim();

    setSubmitting(true);
    setSubmitError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      let res: Response;
      if (selectedFiles.length > 0) {
        const form = new FormData();
        form.set("subject", subject.trim());
        form.set("description", descriptionWithUrls);
        form.set("category", category);
        form.set("priority", priority);
        form.set("source", "ai_fallback");
        selectedFiles.forEach((file) => form.append("files", file));
        res = await fetch(submitEndpoint, {
          method: "POST",
          headers,
          body: form,
        });
      } else {
        res = await fetch(submitEndpoint, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            description: descriptionWithUrls,
            category,
            priority,
            source: "ai_fallback",
          }),
        });
      }
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

      const ticketId = payload.ticket_id ?? payload.ticket?.id;
      setCreatedTicketId(ticketId ?? null);
      onSuccess?.({
        ticketId,
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

  const successHref =
    createdTicketId && successActionHrefForTicket
      ? successActionHrefForTicket(createdTicketId)
      : undefined;

  return (
    <>
      {!showSuccess ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-support-ticket-title"
            className="flex max-h-[min(92vh,820px)] w-full max-w-[600px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between px-5 py-3">
              <h2
                id="create-support-ticket-title"
                className="text-2xl font-semibold leading-8 text-[#0F172A]"
              >
                Create a Ticket
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-[30px] w-8 items-center justify-center rounded-lg border border-[color:var(--brand-secondary,#012352)] text-[color:var(--brand-secondary,#012352)] transition hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
              {submitError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {submitError}
                </div>
              ) : null}

              <div>
                <label htmlFor="ticket-category" className={LABEL_CLASS}>
                  Department
                </label>
                <div className="relative">
                  <select
                    id="ticket-category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      if (errors.category) setErrors((current) => ({ ...current, category: undefined }));
                    }}
                    className={`${SELECT_CLASS} ${!category ? "text-[#94A3B8]" : ""} ${
                      errors.category ? "border-red-400" : ""
                    }`}
                  >
                    <option value="" disabled>
                      Select department.
                    </option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="text-[#0F172A]">
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                    aria-hidden
                  />
                </div>
                {errors.category ? (
                  <p className="mt-1 text-xs text-red-600">{errors.category}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="ticket-priority" className={LABEL_CLASS}>
                  Priority
                </label>
                <div className="relative">
                  <select
                    id="ticket-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}
                    className={SELECT_CLASS}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                    aria-hidden
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ticket-subject" className={LABEL_CLASS}>
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
                  className={`${FIELD_CLASS} placeholder:text-[#94A3B8] ${
                    errors.subject ? "border-red-400" : ""
                  }`}
                />
                {errors.subject ? <p className="mt-1 text-xs text-red-600">{errors.subject}</p> : null}
              </div>

              <div>
                <label htmlFor="ticket-description" className={LABEL_CLASS}>
                  Message
                </label>
                <textarea
                  id="ticket-description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    if (errors.description) {
                      setErrors((current) => ({ ...current, description: undefined }));
                    }
                  }}
                  rows={4}
                  placeholder="Message..."
                  className={`min-h-[110px] w-full resize-y rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-secondary,#012352)] ${
                    errors.description ? "border-red-400" : ""
                  }`}
                />
                {errors.description ? (
                  <p className="mt-1 text-xs text-red-600">{errors.description}</p>
                ) : null}
              </div>

              <TicketFileUploadFields
                files={selectedFiles}
                onFilesChange={setSelectedFiles}
                fileUrl={fileUrl}
                onFileUrlChange={setFileUrl}
                attachedUrls={attachedUrls}
                onAttachedUrlsChange={setAttachedUrls}
                disabled={submitting}
                resetKey={uploadResetKey}
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[color:var(--brand-secondary,#012352)] px-4 py-2 text-sm font-semibold text-[color:var(--brand-secondary,#012352)] transition hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[color:var(--brand-secondary,#012352)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <SuccessModal
        open={showSuccess}
        onClose={handleSuccessClose}
        title="Success!"
        message="New ticket has been created"
        actionLabel={successActionLabel}
        actionHref={successHref}
        onAction={
          createdTicketId && onSuccessAction
            ? () => {
                const ticketId = createdTicketId;
                setShowSuccess(false);
                onClose();
                onSuccessAction(ticketId);
              }
            : undefined
        }
      />
    </>
  );
}
