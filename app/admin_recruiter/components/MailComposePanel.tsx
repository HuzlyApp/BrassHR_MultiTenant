"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Loader2, Pencil, Save } from "lucide-react";
import toast from "react-hot-toast";
import BrandedDeleteIcon from "./BrandedDeleteIcon";
import { EmailComposeForm } from "./CommunicationThreadParts";
import { MailComposeDropdown } from "./MailComposeDropdown";
import { MailComposeFieldRow } from "./MailComposeFieldRow";
import { MailEmailTemplateSelect } from "./MailEmailTemplateSelect";
import { useCandidateEmailTemplates } from "./useCandidateEmailTemplates";
import { useMailDraftSave } from "./useMailDraftSave";
import type { TenantMailInboxItem } from "@/lib/communication/list-tenant-mail-inbox";
import type { MailDraftListItem } from "@/lib/communication/mail-drafts";
import { supabaseBrowser } from "@/lib/supabase-browser";

type CandidateOption = {
  workerId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
};

type WorkerRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_email?: string | null;
  applicant_email?: string | null;
  profile_photo_url?: string | null;
};

function pickFirstNonEmpty(values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function workerDisplayName(row: WorkerRow): string {
  const name = `${row.first_name || ""} ${row.last_name || ""}`.trim();
  return name || "Applicant";
}

function workerEmail(row: WorkerRow): string | null {
  const email = pickFirstNonEmpty([row.email, row.user_email, row.applicant_email]);
  return email || null;
}

type MailComposePanelProps = {
  initialWorkerId?: string | null;
  initialDraft?: MailDraftListItem | null;
  inboxCandidates?: TenantMailInboxItem[];
  onBack?: () => void;
  onSent?: () => Promise<void> | void;
  onDraftSaved?: () => Promise<void> | void;
  onDraftDeleted?: () => void;
};

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function MailComposePanel({
  initialWorkerId = null,
  initialDraft = null,
  inboxCandidates = [],
  onBack,
  onSent,
  onDraftSaved,
  onDraftDeleted,
}: MailComposePanelProps) {
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState(
    initialDraft?.workerId ?? initialWorkerId ?? ""
  );
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const hydratedRef = useRef(false);

  const {
    templates,
    loadingTemplates,
    templatesError,
    selectedTemplateKey,
    setSelectedTemplateKey,
    bodyHtml,
    setBodyHtml,
    previewLoading,
    previewError,
    applyTemplate,
    clearTemplate,
    resetComposeTemplateState,
  } = useCandidateEmailTemplates(selectedWorkerId || null);

  const { draftSaving, draftSavedAt, draftError, saveDraft, queueAutoSave, flushAutoSave } =
    useMailDraftSave(selectedWorkerId || null);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (initialDraft) {
      setSelectedWorkerId(initialDraft.workerId);
      setSubject(initialDraft.subject);
      setBody(initialDraft.body);
      setBodyHtml(initialDraft.bodyHtml);
      if (initialDraft.templateKey) setSelectedTemplateKey(initialDraft.templateKey);
      return;
    }
    setSelectedWorkerId(initialWorkerId ?? "");
    setSubject("");
    setBody("");
    setBodyHtml(null);
    resetComposeTemplateState();
  }, [
    initialDraft,
    initialWorkerId,
    resetComposeTemplateState,
    setBodyHtml,
    setSelectedTemplateKey,
  ]);

  const loadCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/workers", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        workers?: WorkerRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Could not load candidates (${res.status})`);
      }
      const rows = Array.isArray(data.workers) ? data.workers : [];
      const options: CandidateOption[] = rows.map((row) => ({
        workerId: String(row.id),
        name: workerDisplayName(row),
        email: workerEmail(row),
        photoUrl: row.profile_photo_url?.trim() || null,
      }));
      options.sort((a, b) => a.name.localeCompare(b.name));
      setCandidates(options);
    } catch (err) {
      const fallback = inboxCandidates.map((item) => ({
        workerId: item.workerId,
        name: item.candidateName,
        email: item.contactEmail,
        photoUrl: null,
      }));
      setCandidates(fallback);
      setLoadError(
        fallback.length === 0
          ? err instanceof Error
            ? err.message
            : "Could not load candidates."
          : null
      );
    } finally {
      setLoadingCandidates(false);
    }
  }, [inboxCandidates]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    if (!selectedWorkerId || initialDraft?.workerId === selectedWorkerId) return;
    let cancelled = false;

    async function loadWorkerDraft() {
      try {
        const res = await fetch("/api/admin/mail/drafts", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        const json = (await res.json().catch(() => ({}))) as {
          drafts?: MailDraftListItem[];
        };
        if (!res.ok || cancelled) return;
        const draft = (json.drafts ?? []).find((item) => item.workerId === selectedWorkerId);
        if (!draft || cancelled) return;
        setSubject(draft.subject);
        setBody(draft.body);
        setBodyHtml(draft.bodyHtml);
        if (draft.templateKey) setSelectedTemplateKey(draft.templateKey);
      } catch {
        /* ignore */
      }
    }

    void loadWorkerDraft();
    return () => {
      cancelled = true;
    };
  }, [initialDraft?.workerId, selectedWorkerId, setBodyHtml, setSelectedTemplateKey]);

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.workerId === selectedWorkerId) ?? null,
    [candidates, selectedWorkerId]
  );

  const candidatesWithEmail = useMemo(
    () => candidates.filter((candidate) => Boolean(candidate.email?.trim())),
    [candidates]
  );

  const composeEmail = selected?.email?.trim() ? selected.email.trim() : null;

  const emptyHint = useMemo(() => {
    if (loadingCandidates) return "Loading candidates...";
    if (selectedWorkerId && selected && !composeEmail) {
      return `${selected.name} has no email on file.`;
    }
    return "Pick a candidate to write your email.";
  }, [loadingCandidates, selectedWorkerId, selected, composeEmail]);

  const draftPayload = useMemo(
    () => ({
      workerId: selectedWorkerId,
      subject,
      body,
      bodyHtml: bodyHtml?.trim() || null,
      templateKey: selectedTemplateKey || null,
    }),
    [selectedWorkerId, subject, body, bodyHtml, selectedTemplateKey]
  );

  useEffect(() => {
    if (!selectedWorkerId) return;
    queueAutoSave(draftPayload);
  }, [draftPayload, queueAutoSave, selectedWorkerId]);

  useEffect(() => {
    return () => {
      void flushAutoSave();
    };
  }, [flushAutoSave]);

  async function handleCandidateChange(workerId: string) {
    if (selectedWorkerId && (subject.trim() || body.trim())) {
      await saveDraft(
        {
          workerId: selectedWorkerId,
          subject,
          body,
          bodyHtml: bodyHtml?.trim() || null,
          templateKey: selectedTemplateKey || null,
        },
        { silent: true }
      );
    }

    setSelectedWorkerId(workerId);
    setSubject("");
    setBody("");
    setBodyHtml(null);
    clearTemplate();
    setSendError(null);
    setSendSuccess(null);
    setDraftNotice(null);
  }

  async function handleTemplateChange(templateKey: string) {
    setSelectedTemplateKey(templateKey);
    setSendError(null);
    setSendSuccess(null);

    if (!templateKey) {
      setBodyHtml(null);
      return;
    }

    if (!selectedWorkerId) return;

    const preview = await applyTemplate(templateKey, selectedWorkerId);
    if (preview) {
      setSubject(preview.subject);
      setBody(preview.body_text);
      setBodyHtml(preview.body_html);
    }
  }

  async function handleSaveDraft() {
    if (!selectedWorkerId) {
      setDraftNotice("Pick a candidate first.");
      return;
    }
    const ok = await saveDraft(draftPayload);
    if (ok) {
      setDraftNotice("Draft saved.");
      await onDraftSaved?.();
    }
  }

  async function handleBack() {
    await flushAutoSave();
    await onDraftSaved?.();
    onBack?.();
  }

  const canDeleteDraft = Boolean(selectedWorkerId && (initialDraft?.id || draftSavedAt));

  async function handleDeleteDraft() {
    if (!initialDraft?.id && !selectedWorkerId) return;

    const label = selected?.name?.trim() || initialDraft?.candidateName || "this draft";
    const confirmed = window.confirm(`Delete draft for ${label}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingDraft(true);
    try {
      const res = await fetch("/api/admin/mail/drafts", {
        method: "DELETE",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          initialDraft?.id ? { draftId: initialDraft.id } : { workerId: selectedWorkerId }
        ),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || `Could not delete draft (${res.status})`);
      }

      toast.success("Draft deleted.");
      onDraftDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete draft.");
    } finally {
      setDeletingDraft(false);
    }
  }

  async function handleSend() {
    if (!selectedWorkerId || !subject.trim() || !body.trim()) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(selectedWorkerId)}/communications/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            body: body.trim(),
            bodyHtml: bodyHtml?.trim() || null,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ message: string }>;
      };
      if (!res.ok) {
        const detail =
          json.issues?.map((issue) => issue.message).join(" ") ||
          json.error ||
          `Send failed (${res.status})`;
        setSendError(detail);
        return;
      }
      await saveDraft(
        {
          workerId: selectedWorkerId,
          subject: "",
          body: "",
          bodyHtml: null,
          templateKey: null,
        },
        { silent: true }
      );
      setSubject("");
      setBody("");
      setBodyHtml(null);
      clearTemplate();
      setSendSuccess("Email sent.");
      await onSent?.();
      await onDraftSaved?.();
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const candidateOptions = useMemo(
    () =>
      candidatesWithEmail.map((candidate) => ({
        value: candidate.workerId,
        label: candidate.name,
        sublabel: candidate.email ?? undefined,
        avatarUrl: candidate.photoUrl,
      })),
    [candidatesWithEmail]
  );

  const candidateSelect = (
    <MailComposeFieldRow label="Candidate">
      <MailComposeDropdown
        id="mail-compose-candidate"
        value={selectedWorkerId}
        options={candidateOptions}
        placeholder="Pick a candidate"
        disabled={sending}
        loading={loadingCandidates}
        loadingLabel="Loading..."
        alignLabel="stacked"
        showAvatars
        tallTrigger
        onChange={(workerId) => void handleCandidateChange(workerId)}
      />
    </MailComposeFieldRow>
  );

  const templateSelect = (
    <MailEmailTemplateSelect
      templates={templates}
      loading={loadingTemplates}
      value={selectedTemplateKey}
      disabled={sending || !selectedWorkerId}
      previewLoading={previewLoading}
      error={templatesError ?? previewError}
      onChange={(templateKey) => void handleTemplateChange(templateKey)}
    />
  );

  const savedLabel = draftSavedAt
    ? `Saved ${new Date(draftSavedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-5 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={() => void handleBack()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-slate-50"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold leading-5 text-[#1F2937]">
          <Pencil className="h-4 w-4 shrink-0 text-(--brand-primary)" />
          Compose Email
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {savedLabel ? <span className="hidden text-xs text-[#64748B] sm:inline">{savedLabel}</span> : null}
          {canDeleteDraft ? (
            <button
              type="button"
              onClick={() => void handleDeleteDraft()}
              disabled={sending || deletingDraft}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Delete draft"
              title="Delete draft"
            >
              {deletingDraft ? (
                <Loader2 className="h-5 w-5 animate-spin text-(--brand-primary)" />
              ) : (
                <BrandedDeleteIcon className="h-5 w-5" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={sending || draftSaving || !selectedWorkerId}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--brand-primary) bg-white px-3 text-sm font-semibold text-(--brand-primary) transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draftSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Draft
          </button>
        </div>
      </div>

      {loadError ? (
        <p className="border-b border-[#E5E7EB] px-5 py-2 text-xs text-red-600">{loadError}</p>
      ) : null}
      {draftNotice ? (
        <p className="border-b border-[#E5E7EB] px-5 py-2 text-xs text-(--brand-primary)">{draftNotice}</p>
      ) : null}
      {draftError ? (
        <p className="border-b border-[#E5E7EB] px-5 py-2 text-xs text-red-600">{draftError}</p>
      ) : null}

      <EmailComposeForm
        toName={selected?.name ?? "Applicant"}
        toEmail={composeEmail}
        subject={subject}
        body={body}
        sending={sending || previewLoading}
        sendError={sendError}
        sendSuccess={sendSuccess}
        onSubjectChange={(value) => {
          setSubject(value);
          setDraftNotice(null);
          if (selectedTemplateKey) {
            setSelectedTemplateKey("");
            setBodyHtml(null);
          }
        }}
        onBodyChange={(value) => {
          setBody(value);
          setDraftNotice(null);
          if (selectedTemplateKey) {
            setSelectedTemplateKey("");
            setBodyHtml(null);
          }
        }}
        onSend={() => void handleSend()}
        leadingRow={candidateSelect}
        templateRow={templateSelect}
        hideToRow
        emptyHint={emptyHint}
      />
    </div>
  );
}
