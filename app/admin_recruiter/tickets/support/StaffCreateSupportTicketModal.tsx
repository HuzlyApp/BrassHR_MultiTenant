"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Search, Ticket, X } from "lucide-react";
import SuccessModal from "@/app/components/SuccessModal";
import ChatPendingAttachment from "@/app/components/ChatPendingAttachment";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { validateSupportTicketFile } from "@/lib/support-tickets/support-ticket-file-validation";
import type { SupportTicketListItem, SupportTicketPriority } from "@/lib/support-tickets/types";

type WorkerOption = {
  id: string;
  name: string;
  email: string | null;
  jobRole: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (ticket: SupportTicketListItem) => void;
  defaultApplicantId?: string | null;
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

export function StaffCreateSupportTicketModal({
  open,
  onClose,
  onSuccess,
  defaultApplicantId = null,
}: Props) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [errors, setErrors] = useState<{
    subject?: string;
    description?: string;
    applicantId?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<SupportTicketListItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("normal");
      setApplicantId(defaultApplicantId);
      setSearch("");
      setErrors({});
      setSubmitError(null);
      setShowSuccess(false);
      setCreatedTicket(null);
      setSelectedFile(null);
      setUploadError(null);
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open, defaultApplicantId]);

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

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoadingWorkers(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams();
          if (search.trim()) params.set("q", search.trim());
          const res = await fetch(`/api/admin/messages/workers?${params.toString()}`, {
            cache: "no-store",
            credentials: "include",
          });
          const payload = (await res.json().catch(() => ({}))) as {
            workers?: WorkerOption[];
            error?: string;
          };
          if (!alive) return;
          if (!res.ok) throw new Error(payload.error || "Could not load workers.");
          setWorkers(payload.workers ?? []);
        } catch (err) {
          if (alive) {
            setSubmitError(err instanceof Error ? err.message : "Could not load workers.");
          }
        } finally {
          if (alive) setLoadingWorkers(false);
        }
      })();
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === applicantId) ?? null,
    [applicantId, workers]
  );

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: { subject?: string; description?: string; applicantId?: string } = {};
    if (!applicantId) nextErrors.applicantId = "Select a worker for this ticket.";
    if (!subject.trim()) nextErrors.subject = "Subject is required.";
    if (!description.trim()) nextErrors.description = "Please describe the request.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      let res: Response;
      if (selectedFile) {
        const form = new FormData();
        form.set("subject", subject.trim());
        form.set("description", description.trim());
        form.set("category", category);
        form.set("priority", priority);
        form.set("source", "staff_on_behalf");
        form.set("applicantId", applicantId!);
        form.set("file", selectedFile);
        res = await fetch("/api/support-tickets", {
          method: "POST",
          credentials: "include",
          body: form,
        });
      } else {
        res = await fetch("/api/support-tickets", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            description: description.trim(),
            category,
            priority,
            source: "staff_on_behalf",
            applicantId,
          }),
        });
      }

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        ticket?: SupportTicketListItem;
      };
      if (!res.ok || !payload.ticket) {
        throw new Error(payload.error || "Could not create support ticket.");
      }

      setCreatedTicket(payload.ticket);
      onSuccess?.(payload.ticket);
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
          aria-labelledby="staff-create-support-ticket-title"
          className="max-h-[min(92vh,760px)] w-full max-w-[640px] overflow-y-auto rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-end border-b border-[#E5E7EB] px-3.5 py-3">
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white transition hover:brightness-110 disabled:opacity-60"
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
                <h2
                  id="staff-create-support-ticket-title"
                  className="text-2xl font-semibold text-[#0F172A]"
                >
                  Create Support Ticket
                </h2>
                <p className="mt-0.5 text-sm text-[#64748B]">
                  Open a ticket on behalf of a worker. The worker remains the requester; you are
                  recorded as the creator.
                </p>
              </div>
            </div>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            ) : null}

            <div className="px-2">
              <label htmlFor="staff-ticket-worker-search" className="mb-1 block text-sm text-[#374151]">
                Worker <span className="text-red-600">*</span>
              </label>
              {selectedWorker ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0F172A]">{selectedWorker.name}</p>
                    <p className="truncate text-xs text-[#64748B]">
                      {selectedWorker.email ?? selectedWorker.jobRole ?? "Worker"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setApplicantId(null)}
                    disabled={submitting}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[#012352] hover:bg-white disabled:opacity-60"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      id="staff-ticket-worker-search"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        if (errors.applicantId) {
                          setErrors((current) => ({ ...current, applicantId: undefined }));
                        }
                      }}
                      placeholder="Search workers by name or email"
                      className={`h-11 w-full rounded-lg border bg-white pl-9 pr-3.5 text-sm text-[#0F172A] outline-none focus:border-(--brand-primary) ${
                        errors.applicantId ? "border-red-400" : "border-[#CBD5E1]"
                      }`}
                    />
                  </div>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#E5E7EB]">
                    {loadingWorkers ? (
                      <CandidateDetailLoader label="Loading workers..." className="min-h-0 py-6" />
                    ) : workers.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-[#64748B]">No workers found.</p>
                    ) : (
                      workers.slice(0, 12).map((worker) => (
                        <button
                          key={worker.id}
                          type="button"
                          onClick={() => {
                            setApplicantId(worker.id);
                            setErrors((current) => ({ ...current, applicantId: undefined }));
                          }}
                          className="flex w-full flex-col items-start border-b border-[#F1F5F9] px-3 py-2.5 text-left transition hover:bg-[#F8FAFC] last:border-b-0"
                        >
                          <span className="text-sm font-medium text-[#0F172A]">{worker.name}</span>
                          <span className="text-xs text-[#64748B]">
                            {worker.email ?? worker.jobRole ?? "Worker"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
              {errors.applicantId ? (
                <p className="mt-1 text-xs text-red-600">{errors.applicantId}</p>
              ) : null}
            </div>

            <div className="grid gap-4 px-2 sm:grid-cols-2">
              <div>
                <label htmlFor="staff-ticket-category" className="mb-1 block text-sm text-[#374151]">
                  Category
                </label>
                <select
                  id="staff-ticket-category"
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
                <label htmlFor="staff-ticket-priority" className="mb-1 block text-sm text-[#374151]">
                  Priority
                </label>
                <select
                  id="staff-ticket-priority"
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
              <label htmlFor="staff-ticket-subject" className="mb-1 block text-sm text-[#374151]">
                Subject
              </label>
              <input
                id="staff-ticket-subject"
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
              <label htmlFor="staff-ticket-description" className="mb-1 block text-sm text-[#374151]">
                Details of request
              </label>
              <textarea
                id="staff-ticket-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (errors.description) {
                    setErrors((current) => ({ ...current, description: undefined }));
                  }
                }}
                rows={4}
                placeholder="Describe the issue or request"
                className={`min-h-[100px] w-full resize-y rounded-lg border px-3.5 py-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-(--brand-primary) ${
                  errors.description ? "border-red-400" : "border-[#CBD5E1]"
                }`}
              />
              {errors.description ? (
                <p className="mt-1 text-xs text-red-600">{errors.description}</p>
              ) : null}
            </div>

            <div className="px-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) {
                    setSelectedFile(null);
                    setUploadError(null);
                    return;
                  }
                  const validation = validateSupportTicketFile(file);
                  if (validation) {
                    setUploadError(validation);
                    setSelectedFile(null);
                    return;
                  }
                  setUploadError(null);
                  setSelectedFile(file);
                }}
              />
              {selectedFile ? (
                <ChatPendingAttachment file={selectedFile} onRemove={() => setSelectedFile(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-medium text-[#0F172A] transition hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  <Paperclip className="h-4 w-4" />
                  Attach file (optional)
                </button>
              )}
              {uploadError ? <p className="mt-1 text-xs text-red-600">{uploadError}</p> : null}
            </div>

            <div className="flex gap-5 px-2 pb-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="min-h-11 flex-1 rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-semibold text-[#012352] transition hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 flex-1 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
        message={
          createdTicket
            ? `Support ticket created for ${createdTicket.applicant_name ?? "the worker"}.`
            : "Support ticket created."
        }
      />
    </>
  );
}
