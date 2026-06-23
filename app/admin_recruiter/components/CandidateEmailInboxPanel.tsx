"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Inbox,
  LayoutTemplate,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Send,
} from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  defaultReplySubject,
  type CommunicationThread,
} from "@/lib/communication/conversation-client";
import { communicationDirectionFromRow } from "@/lib/communication/direction";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  CommunicationMessageBubble,
  CommunicationThreadComposer,
  EmailComposeForm,
} from "./CommunicationThreadParts";

type ContactInfo = {
  name: string;
  email: string | null;
  phone: string | null;
};

type EmailFolder = "inbox" | "sent" | "drafts" | "compose" | "integration";

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

function SidebarNavItem({
  active,
  label,
  icon: Icon,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Inbox;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-2.5 text-left text-sm transition ${
        active
          ? "font-medium text-(--brand-primary)"
          : "text-[#374151] hover:bg-white/80"
      }`}
    >
      <span className="inline-flex items-center gap-2.5">
        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-(--brand-primary)" : "text-[#6B7280]"}`} />
        {label}
      </span>
      {typeof count === "number" && count > 0 ? (
        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B7280]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SidebarLinkItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof LayoutTemplate;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-sm text-[#374151] transition hover:bg-white/80"
    >
      <Icon className="h-4 w-4 shrink-0 text-[#6B7280]" />
      {label}
    </Link>
  );
}

type Props = {
  workerId: string;
  candidateName: string;
  contact: ContactInfo | null;
  emailThreads: CommunicationThread[];
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
};

export default function CandidateEmailInboxPanel({
  workerId,
  candidateName,
  contact,
  emailThreads,
  loading,
  error,
  onRefresh,
}: Props) {
  const router = useRouter();
  const branding = useTenantBranding();
  const companyName = branding.companyName?.trim() || "your organization";

  const [folder, setFolder] = useState<EmailFolder>("inbox");
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

  const displayName = candidateName || contact?.name || "Applicant";
  const candidateEmail = contact?.email?.trim() ?? null;

  const loadEmailConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        resendFromDomain?: string | null;
        error?: string;
        code?: string;
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
    if (folder === "compose") return;
    if (!emailConfigured && folder !== "integration") {
      setFolder("integration");
    }
  }, [emailConfigured, folder]);

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

  async function sendEmail(subject: string, body: string) {
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
          body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
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
    setSendError(null);
    setSendSuccess(null);
  }

  const showIntegration =
    folder === "integration" || (emailConfigured === false && !configLoading);

  const mainContent = (() => {
    if (configLoading || (loading && emailThreads.length === 0)) {
      return (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin text-(--brand-primary)" />
          Loading email...
        </div>
      );
    }

    if (error && emailThreads.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      );
    }

    if (showIntegration) {
      if (emailConfigured) {
        return (
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
            <h3 className="text-lg font-semibold text-[#111827]">Email is connected</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6B7280]">
              Your organization email is set up through {companyName}. You can send emails to
              candidates and manage templates below.
            </p>
            <button
              type="button"
              onClick={() => router.push("/admin_recruiter/email-templates")}
              className="mt-8 rounded-lg bg-(--brand-primary) px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Manage email templates
            </button>
          </div>
        );
      }

      return (
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
          <h3 className="text-lg font-semibold text-[#111827]">
            Integrate your Google or Outlook email
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#6B7280]">
            Integrating your email will allow you to seamlessly send and receive emails from
            candidates in your database directly within {companyName}.
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin_recruiter/email-templates")}
            className="mt-2 text-sm font-medium text-(--brand-primary) hover:underline"
          >
            Learn more about email integrations
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin_recruiter/email-templates")}
            className="mt-8 rounded-lg bg-(--brand-primary) px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Integrate your email
          </button>
        </div>
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
          <div className="border-b border-[#E5E7EB] px-5 py-3">
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
            sending={sending}
            sendError={sendError}
            sendSuccess={sendSuccess}
            onSubjectChange={setComposeSubject}
            onBodyChange={setComposeBody}
            onSend={() => void sendEmail(composeSubject, composeBody)}
          />
        </div>
      );
    }

  return (
      <>
        <div className="border-b border-[#E5E7EB] px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold leading-5 text-[#1F2937]">
              <Mail className="h-4 w-4 text-(--brand-primary)" />
              {folder === "sent" ? "Sent" : "Inbox"}
            </div>
            {activeThread && !isPlaceholderThread(activeThread) ? (
              <span className="text-xs text-[#6B7280]">
                {displayName} · {activeThread.contactEmail ?? candidateEmail ?? "—"}
              </span>
            ) : null}
          </div>
          {activeThread?.rootSubject ? (
            <p className="mt-1 truncate text-xs text-[#64748B]">{activeThread.rootSubject}</p>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-white px-5 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin text-(--brand-primary)" />
              Loading messages...
            </div>
          ) : !activeThread || visibleMessages.length === 0 ? (
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

  return (
    <div className="grid min-h-[420px] grid-cols-12">
      <aside className="col-span-12 flex flex-col border-b border-[#E5E7EB] bg-[#FAFBFC] md:col-span-3 md:border-b-0 md:border-r">
        <div className="p-4">
          <button
            type="button"
            onClick={openCompose}
            disabled={!emailConfigured || !candidateEmail}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-(--brand-primary) bg-white px-3 py-2.5 text-sm font-semibold text-(--brand-primary) transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
            Compose
          </button>

          <div className="space-y-0.5">
            <SidebarNavItem
              active={folder === "inbox"}
              label="Inbox"
              icon={Inbox}
              count={inboxCount}
              onClick={() => setFolder("inbox")}
            />
            <SidebarNavItem
              active={folder === "sent"}
              label="Sent"
              icon={Send}
              count={sentCount}
              onClick={() => setFolder("sent")}
            />
            <SidebarNavItem
              active={folder === "drafts"}
              label="Drafts"
              icon={Archive}
              onClick={() => setFolder("drafts")}
            />
          </div>

          <div className="my-4 border-t border-[#E5E7EB]" />

          <div className="space-y-0.5">
            <SidebarLinkItem
              href="/admin_recruiter/email-templates"
              label="Manage Templates"
              icon={LayoutTemplate}
            />
            <button
              type="button"
              onClick={() => setFolder("integration")}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-sm transition ${
                folder === "integration"
                  ? "font-medium text-(--brand-primary)"
                  : "text-[#374151] hover:bg-white/80"
              }`}
            >
              <Link2
                className={`h-4 w-4 shrink-0 ${
                  folder === "integration" ? "text-(--brand-primary)" : "text-[#6B7280]"
                }`}
              />
              Email Integration
            </button>
          </div>
        </div>
      </aside>

      <main className="col-span-12 flex min-w-0 flex-col bg-white md:col-span-9">{mainContent}</main>
    </div>
  );
}
