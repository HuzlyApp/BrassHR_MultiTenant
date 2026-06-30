"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ChevronLeft, Loader2, Mail, Pencil } from "lucide-react";
import {
  defaultReplySubject,
  type CommunicationThread,
} from "@/lib/communication/conversation-client";
import { communicationDirectionFromRow } from "@/lib/communication/direction";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EmailIntegrationPanel } from "./EmailIntegrationPanel";
import {
  EmailInboxSidebar,
  type EmailInboxFolder,
} from "./EmailInboxSidebar";
import {
  CommunicationMessageBubble,
  CommunicationThreadComposer,
  EmailComposeForm,
} from "./CommunicationThreadParts";
import { MailEmailTemplateSelect } from "./MailEmailTemplateSelect";
import { useCandidateEmailTemplates } from "./useCandidateEmailTemplates";

type ContactInfo = {
  name: string;
  email: string | null;
  phone: string | null;
};

type EmailFolder = EmailInboxFolder;

async function authHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isPlaceholderThread(thread: CommunicationThread | null): boolean {
  return Boolean(thread?.conversationId.startsWith("placeholder-"));
}

type Props = {
  workerId: string;
  candidateName: string;
  contact: ContactInfo | null;
  emailThreads: CommunicationThread[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
  hideSidebar?: boolean;
  initialFolder?: EmailFolder;
  onBack?: () => void;
};

export default function CandidateEmailInboxPanel({
  workerId,
  candidateName,
  contact,
  emailThreads,
  loading,
  error,
  onRefresh,
  hideSidebar = false,
  initialFolder = "inbox",
  onBack,
}: Props) {
  const router = useRouter();

  const [folder, setFolder] = useState<EmailFolder>(initialFolder);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    templates,
    loadingTemplates,
    templatesError,
    selectedTemplateKey,
    setSelectedTemplateKey,
    bodyHtml: composeBodyHtml,
    setBodyHtml: setComposeBodyHtml,
    previewLoading,
    previewError,
    applyTemplate,
    clearTemplate,
    resetComposeTemplateState,
  } = useCandidateEmailTemplates(workerId);

  const displayName = candidateName || contact?.name || "Applicant";
  const candidateEmail = contact?.email?.trim() ?? null;

  useEffect(() => {
    setFolder(initialFolder);
  }, [initialFolder, workerId]);

  const loadEmailConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        resendFromDomain?: string | null;
      };
      setEmailConfigured(res.ok && Boolean(json.resendFromDomain?.trim()));
    } catch {
      setEmailConfigured(false);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmailConfig();
  }, [loadEmailConfig]);

  const activeThread = useMemo(() => {
    if (emailThreads.length === 0) return null;
    if (selectedThreadId) {
      const found = emailThreads.find((t) => t.conversationId === selectedThreadId);
      if (found) return found;
    }
    return emailThreads[0] ?? null;
  }, [emailThreads, selectedThreadId]);

  const inboxCount = emailThreads.reduce((sum, t) => sum + t.messageCount, 0);
  const sentCount = useMemo(
    () =>
      emailThreads.reduce(
        (sum, t) =>
          sum + t.messages.filter((m) => communicationDirectionFromRow(m) === "outbound").length,
        0
      ),
    [emailThreads]
  );

  const visibleMessages = useMemo(() => {
    if (!activeThread) return [];
    if (folder === "sent") {
      return activeThread.messages.filter((m) => communicationDirectionFromRow(m) === "outbound");
    }
    return activeThread.messages;
  }, [activeThread, folder]);

  useEffect(() => {
    if (hideSidebar) return;
    if (folder === "compose") return;
    if (!emailConfigured && folder !== "integration") {
      setFolder("integration");
    }
  }, [emailConfigured, folder, hideSidebar]);

  useEffect(() => {
    if (folder !== "inbox" && folder !== "sent") return;
    if (!activeThread) return;
    setReplyBody("");
    setSendError(null);
    setSendSuccess(null);
    setReplySubject(defaultReplySubject(activeThread));
  }, [activeThread?.conversationId, folder]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [visibleMessages, loading, sending, folder]);

  async function sendEmail(subject: string, body: string, bodyHtml?: string | null) {
    if (!body.trim() || !subject.trim()) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/email`,
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
      setReplyBody("");
      setComposeBody("");
      setComposeSubject("");
      setComposeBodyHtml(null);
      clearTemplate();
      setSendSuccess("Email sent.");
      setFolder("inbox");
      await onRefresh();
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function openCompose() {
    setFolder("compose");
    setComposeSubject("");
    setComposeBody("");
    resetComposeTemplateState();
    setSendError(null);
    setSendSuccess(null);
  }

  async function handleTemplateChange(templateKey: string) {
    setSelectedTemplateKey(templateKey);
    setSendError(null);
    setSendSuccess(null);

    if (!templateKey) {
      setComposeBodyHtml(null);
      return;
    }

    const preview = await applyTemplate(templateKey, workerId);
    if (preview) {
      setComposeSubject(preview.subject);
      setComposeBody(preview.body_text);
      setComposeBodyHtml(preview.body_html);
    }
  }

  const showIntegration =
    folder === "integration" || (emailConfigured === false && !configLoading && !hideSidebar);

  const mainContent = (() => {
    if (configLoading || (loading && emailThreads.length === 0)) {
      return null;
    }

    if (error && emailThreads.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      );
    }

    if (showIntegration) {
      return (
        <EmailIntegrationPanel
          emailConfigured={Boolean(emailConfigured)}
          onManageTemplates={() => router.push("/admin_recruiter/email-templates")}
        />
      );
    }

    if (folder === "drafts") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Archive className="mb-3 h-10 w-10 text-[#CBD5E1]" />
          <p className="text-sm font-medium text-[#374151]">No drafts</p>
          <p className="mt-1 text-xs text-[#6B7280]">Saved drafts will appear here.</p>
        </div>
      );
    }

    if (folder === "compose") {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-5 py-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-slate-50"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div className="inline-flex items-center gap-2 text-sm font-semibold leading-5 text-[#1F2937]">
              <Pencil className="h-4 w-4 text-(--brand-primary)" />
              Compose Email
            </div>
          </div>
          <EmailComposeForm
            toName={displayName}
            toEmail={candidateEmail}
            subject={composeSubject}
            body={composeBody}
            sending={sending || previewLoading}
            sendError={sendError}
            sendSuccess={sendSuccess}
            onSubjectChange={(value) => {
              setComposeSubject(value);
              if (selectedTemplateKey) {
                setSelectedTemplateKey("");
                setComposeBodyHtml(null);
              }
            }}
            onBodyChange={(value) => {
              setComposeBody(value);
              if (selectedTemplateKey) {
                setSelectedTemplateKey("");
                setComposeBodyHtml(null);
              }
            }}
            onSend={() => void sendEmail(composeSubject, composeBody, composeBodyHtml)}
            templateRow={
              candidateEmail ? (
                <MailEmailTemplateSelect
                  templates={templates}
                  loading={loadingTemplates}
                  value={selectedTemplateKey}
                  disabled={sending}
                  previewLoading={previewLoading}
                  error={templatesError ?? previewError}
                  onChange={(templateKey) => void handleTemplateChange(templateKey)}
                />
              ) : null
            }
          />
        </div>
      );
    }

    return (
      <>
        <div className="border-b border-[#E5E7EB] px-5 py-3">
          <div className="flex items-center gap-2">
            {hideSidebar && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-slate-50"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold leading-5 text-[#1F2937]">
                <Mail className="h-4 w-4 text-(--brand-primary)" />
                {folder === "sent" ? "Sent" : "Inbox"}
              </div>
              {activeThread && !isPlaceholderThread(activeThread) ? (
                <span className="truncate text-xs text-[#6B7280]">
                  {displayName} · {activeThread.contactEmail ?? candidateEmail ?? "—"}
                </span>
              ) : null}
            </div>
          </div>
          {activeThread?.rootSubject ? (
            <p className="mt-1 truncate text-xs text-[#64748B]">{activeThread.rootSubject}</p>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-white px-5 py-4">
          {loading ? null : !activeThread || visibleMessages.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <Mail className="mb-3 h-10 w-10 text-[#CBD5E1]" />
              <p className="text-sm font-medium text-[#374151]">
                {folder === "sent" ? "No sent emails yet" : "No emails yet"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-[#6B7280]">
                {folder === "sent"
                  ? "Emails you send will appear here."
                  : `Compose an email to ${displayName}.`}
              </p>
              {folder === "inbox" ? (
                <button
                  type="button"
                  onClick={openCompose}
                  className="mt-4 rounded-lg border border-(--brand-primary) px-4 py-2 text-xs font-semibold text-(--brand-primary) hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                >
                  Compose
                </button>
              ) : null}
            </div>
          ) : (
            visibleMessages.map((row) => (
              <CommunicationMessageBubble key={row.id} row={row} contact={contact} />
            ))
          )}
        </div>

        {folder === "inbox" && activeThread && visibleMessages.length > 0 && candidateEmail ? (
          <CommunicationThreadComposer
            channel="email"
            replyBody={replyBody}
            replySubject={replySubject}
            sendingReply={sending}
            sendError={sendError}
            sendSuccess={sendSuccess}
            onBodyChange={setReplyBody}
            onSubjectChange={setReplySubject}
            onSend={() => void sendEmail(replySubject, replyBody)}
          />
        ) : null}
      </>
    );
  })();

  if (hideSidebar) {
    return <div className="flex min-h-0 flex-1 flex-col">{mainContent}</div>;
  }

  return (
    <div className="grid min-h-[420px] grid-cols-12">
      <EmailInboxSidebar
        folder={folder}
        inboxCount={inboxCount}
        sentCount={sentCount}
        emailConfigured={Boolean(emailConfigured)}
        composeDisabled={!emailConfigured || !candidateEmail}
        onCompose={openCompose}
        onFolderChange={setFolder}
      />
      <main className="col-span-12 flex min-w-0 flex-col bg-white md:col-span-9">{mainContent}</main>
    </div>
  );
}
