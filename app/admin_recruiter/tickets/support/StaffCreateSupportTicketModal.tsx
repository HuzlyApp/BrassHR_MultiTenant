"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import SuccessModal from "@/app/components/SuccessModal";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { TicketFileUploadFields } from "@/app/components/support/TicketFileUploadFields";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { SUPPORT_DEPARTMENT_CATEGORY_OPTIONS } from "@/lib/support-tickets/support-departments";
import { validateTicketSubjectAndMessage } from "@/lib/support-tickets/ticket-field-validation";
import type { DepartmentRecord } from "@/lib/departments/types";
import type { SupportTicketListItem, SupportTicketPriority } from "@/lib/support-tickets/types";

type WorkerOption = {
  id: string;
  name: string;
  email: string | null;
  jobRole: string | null;
};

type CategoryOption = { value: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (ticket: SupportTicketListItem) => void;
  defaultApplicantId?: string | null;
  defaultCategory?: string;
  /** When false (Help & Support), hide worker assignment. Chat keeps this true. */
  requireWorker?: boolean;
};

const FALLBACK_CATEGORY_OPTIONS: CategoryOption[] = SUPPORT_DEPARTMENT_CATEGORY_OPTIONS;

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

export function StaffCreateSupportTicketModal({
  open,
  onClose,
  onSuccess,
  defaultApplicantId = null,
  defaultCategory = "general",
  requireWorker = true,
}: Props) {
  const branding = useTenantBranding();
  const secondaryColor = branding.secondaryHex || "#012352";
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("high");
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [errors, setErrors] = useState<{
    subject?: string;
    description?: string;
    applicantId?: string;
    category?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<SupportTicketListItem | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(FALLBACK_CATEGORY_OPTIONS);
  const wasOpenRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const resolvedDefaultCategory = useMemo(() => {
    if (!defaultCategory) return "";
    const match = categoryOptions.find(
      (option) =>
        option.value === defaultCategory ||
        option.label.toLowerCase() === defaultCategory.toLowerCase()
    );
    return match?.value ?? (categoryOptions.some((o) => o.value === defaultCategory) ? defaultCategory : "");
  }, [defaultCategory, categoryOptions]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/admin/departments", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const rows = ((payload.departments ?? []) as DepartmentRecord[]).filter((row) => row.isActive);
        if (!alive || rows.length === 0) return;
        setCategoryOptions(
          rows.map((row) => ({
            value: row.id,
            label: row.name,
          }))
        );
      } catch {
        // Keep fallback support categories.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSubject("");
      setDescription("");
      setCategory(resolvedDefaultCategory);
      setPriority("high");
      setApplicantId(defaultApplicantId);
      setSearch("");
      setErrors({});
      setSubmitError(null);
      setShowSuccess(false);
      setCreatedTicket(null);
      setSelectedFiles([]);
      setFileUrl("");
      setAttachedUrls([]);
      setUploadResetKey((current) => current + 1);
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open, defaultApplicantId, resolvedDefaultCategory]);

  useEffect(() => {
    if (!open) return;
    if (!category && resolvedDefaultCategory) setCategory(resolvedDefaultCategory);
  }, [open, category, resolvedDefaultCategory]);

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
    if (!open || !requireWorker) return;
    let alive = true;
    setLoadingWorkers(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams();
          params.set("employmentOnly", "1");
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
  }, [open, search, requireWorker]);

  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === applicantId) ?? null,
    [applicantId, workers]
  );

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const fieldErrors = validateTicketSubjectAndMessage({ subject, description });
    const nextErrors: {
      subject?: string;
      description?: string;
      applicantId?: string;
      category?: string;
    } = { ...fieldErrors };
    if (requireWorker && !applicantId) {
      nextErrors.applicantId = "Select a worker for this ticket.";
    }
    if (!category) nextErrors.category = "Select a department.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const descriptionWithUrls =
      attachedUrls.length > 0
        ? `${description.trim()}\n\nAttached file URLs:\n${attachedUrls.map((url) => `- ${url}`).join("\n")}`
        : description.trim();

    const ticketSource = requireWorker ? "staff_on_behalf" : "staff";
    const resolvedApplicantId = requireWorker ? applicantId : null;

    setSubmitting(true);
    setSubmitError(null);
    try {
      let res: Response;
      if (selectedFiles.length > 0) {
        const form = new FormData();
        form.set("subject", subject.trim());
        form.set("description", descriptionWithUrls);
        form.set("category", category);
        form.set("priority", priority);
        form.set("source", ticketSource);
        if (resolvedApplicantId) form.set("applicantId", resolvedApplicantId);
        selectedFiles.forEach((file) => form.append("files", file));
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
            description: descriptionWithUrls,
            category,
            priority,
            source: ticketSource,
            ...(resolvedApplicantId ? { applicantId: resolvedApplicantId } : {}),
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
          className="flex max-h-[min(92vh,820px)] w-full max-w-[600px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between px-5 py-3">
            <h2
              id="staff-create-support-ticket-title"
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

            {requireWorker ? (
              <div>
                <label htmlFor="staff-ticket-worker-search" className={LABEL_CLASS}>
                  Worker
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
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[color:var(--brand-secondary,#012352)] hover:bg-white disabled:opacity-60"
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
                        className={`${FIELD_CLASS} pl-9 ${errors.applicantId ? "border-red-400" : ""}`}
                      />
                    </div>
                    <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-[#E5E7EB]">
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
            ) : null}

            <div>
              <label htmlFor="staff-ticket-category" className={LABEL_CLASS}>
                Department
              </label>
              <div className="relative">
                <select
                  id="staff-ticket-category"
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
                  {categoryOptions.map((option) => (
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
              {errors.category ? <p className="mt-1 text-xs text-red-600">{errors.category}</p> : null}
            </div>

            <div>
              <label htmlFor="staff-ticket-priority" className={LABEL_CLASS}>
                Priority
              </label>
              <div className="relative">
                <select
                  id="staff-ticket-priority"
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
              <label htmlFor="staff-ticket-subject" className={LABEL_CLASS}>
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
                className={`${FIELD_CLASS} placeholder:text-[#94A3B8] ${
                  errors.subject ? "border-red-400" : ""
                }`}
              />
              {errors.subject ? <p className="mt-1 text-xs text-red-600">{errors.subject}</p> : null}
            </div>

            <div>
              <label htmlFor="staff-ticket-description" className={LABEL_CLASS}>
                Message
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
                className="inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-[#F8FAFC] disabled:opacity-60"
                style={{ borderColor: secondaryColor, color: secondaryColor }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: secondaryColor }}
              >
                {submitting ? "Submitting..." : "Submit"}
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
