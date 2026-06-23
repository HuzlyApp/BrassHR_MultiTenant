"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import {
  type CommunicationThread,
} from "@/lib/communication/conversation-client";
import CandidateEmailInboxPanel from "./CandidateEmailInboxPanel";
import {
  CommunicationMessageBubble,
  CommunicationThreadComposer,
} from "./CommunicationThreadParts";


type ContactInfo = {
  name: string;
  email: string | null;
  phone: string | null;
};

function threadContactLine(thread: CommunicationThread): string {
  if (thread.channel === "email") {
    return thread.contactEmail ?? "No email on file";
  }
  return thread.contactPhone ?? "No phone on file";
}

function isPlaceholderThread(thread: CommunicationThread | null): boolean {
  return Boolean(thread?.conversationId.startsWith("placeholder-"));
}

export type InboxChannel = "sms" | "email";

export function InboxChannelTabButtons({
  active,
  onChange,
}: {
  active: InboxChannel;
  onChange: (channel: InboxChannel) => void;
}) {
  return (
    <>
      <InboxSubTab active={active === "sms"} label="SMS" onClick={() => onChange("sms")} />
      <InboxSubTab active={active === "email"} label="Email" onClick={() => onChange("email")} />
    </>
  );
}

function InboxSubTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
        active
          ? "-mb-px border-b-2 border-(--brand-primary) text-(--brand-primary)"
          : "border-b-2 border-transparent text-[#2B3D51] hover:text-(--brand-primary)"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </button>
  );
}

type Props = {
  workerId: string;
  refreshKey?: number;
  embedded?: boolean;
  candidateName?: string;
  /** When true, parent renders SMS/Email tabs outside the card. */
  hideSubTabs?: boolean;
  inboxNav?: InboxChannel;
  onInboxNavChange?: (channel: InboxChannel) => void;
  onCountsChange?: (counts: { sms: number; email: number }) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export default function CandidateCommunicationHistory({
  workerId,
  refreshKey = 0,
  embedded = false,
  candidateName,
  hideSubTabs = false,
  inboxNav: inboxNavProp,
  onInboxNavChange,
  onCountsChange,
  onLoadingChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [inboxNavInternal, setInboxNavInternal] = useState<InboxChannel>("sms");
  const inboxNav = inboxNavProp ?? inboxNavInternal;
  const setInboxNav = onInboxNavChange ?? setInboxNavInternal;
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    onLoadingChange?.(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/communications`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        threads?: CommunicationThread[];
        contact?: ContactInfo;
        error?: string;
      };
      if (!res.ok) {
        setThreads([]);
        setError(json.error || `Failed to load (${res.status})`);
        return;
      }
      setThreads(json.threads ?? []);
      setContact(json.contact ?? null);
    } catch {
      setThreads([]);
      setError("Could not load communication history.");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [workerId, onLoadingChange]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const displayName = candidateName ?? contact?.name ?? "Applicant";

  const smsThreads = useMemo(
    () => threads.filter((thread) => thread.channel === "sms"),
    [threads]
  );
  const emailThreads = useMemo(
    () => threads.filter((thread) => thread.channel === "email"),
    [threads]
  );

  const smsCount = smsThreads.reduce((sum, t) => sum + t.messageCount, 0);
  const emailCount = emailThreads.reduce((sum, t) => sum + t.messageCount, 0);

  useEffect(() => {
    onCountsChange?.({ sms: smsCount, email: emailCount });
  }, [smsCount, emailCount, onCountsChange]);

  const placeholderThread = useCallback(
    (channel: InboxChannel): CommunicationThread => ({
      conversationId: `placeholder-${channel}`,
      channel,
      contactId: workerId,
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
      messageCount: 0,
      latestAt: new Date(0).toISOString(),
      latestStatus: "sent",
      latestSubject: null,
      rootSubject: null,
      latestPreview: "",
      unreadCount: 0,
      messages: [],
    }),
    [workerId, contact]
  );

  const visibleThreads = useMemo(() => {
    if (smsThreads.length > 0) return smsThreads;
    return [placeholderThread("sms")];
  }, [smsThreads, placeholderThread]);

  const selectedThread = useMemo(() => {
    if (selectedThreadId) {
      const found = visibleThreads.find((t) => t.conversationId === selectedThreadId);
      if (found) return found;
    }
    return visibleThreads[0] ?? null;
  }, [selectedThreadId, visibleThreads]);

  useEffect(() => {
    if (!selectedThread) return;
    const updated = threads.find((t) => t.conversationId === selectedThread.conversationId);
    if (updated && !isPlaceholderThread(updated)) {
      setSelectedThreadId(updated.conversationId);
    }
  }, [threads, selectedThread]);

  useEffect(() => {
    if (inboxNav !== "sms") return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [selectedThread?.messages, loading, sendingReply, inboxNav]);

  useEffect(() => {
    setReplyBody("");
    setSendError(null);
    setSendSuccess(null);
    setReplySubject("");
  }, [selectedThread?.conversationId]);

  useEffect(() => {
    const first = visibleThreads[0];
    if (!first || inboxNav !== "sms") return;
    if (!selectedThreadId || !visibleThreads.some((t) => t.conversationId === selectedThreadId)) {
      setSelectedThreadId(first.conversationId);
    }
  }, [visibleThreads, selectedThreadId, inboxNav]);

  async function sendSmsReply() {
    if (!replyBody.trim()) return;

    setSendingReply(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/sms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: replyBody.trim() }),
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
      setSendSuccess("SMS sent.");
      await load();
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSendingReply(false);
    }
  }

  const smsSplitPane = (
    <div className={`grid grid-cols-12 ${embedded ? "min-h-[420px]" : "min-h-[440px]"}`}>
      <aside className="col-span-12 border-b border-[#E5E7EB] bg-[#FAFBFC] md:col-span-3 md:border-b-0 md:border-r">
        <div className="space-y-2 p-4">
          {loading ? (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-[#6B7280]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-(--brand-primary)" />
              Loading...
            </div>
          ) : error ? (
            <p className="px-1 py-2 text-xs text-red-600">{error}</p>
          ) : (
            visibleThreads.map((thread) => {
              const isActive = selectedThread?.conversationId === thread.conversationId;
              const hasMessages = thread.messageCount > 0;
              return (
                <button
                  key={thread.conversationId}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.conversationId)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-xs transition ${
                    isActive
                      ? "border-(--brand-primary) bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] text-(--brand-primary)"
                      : "border-transparent text-[#6B7280] hover:bg-white"
                  }`}
                >
                  <span className="min-w-0 font-medium">
                    <span className="block truncate">{displayName}</span>
                    <span className={`mt-0.5 block truncate text-[10px] ${isActive ? "text-(--brand-primary)" : "text-[#94A3B8]"}`}>
                      {threadContactLine(thread)}
                    </span>
                  </span>
                  {hasMessages ? (
                    <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]">
                      {thread.messageCount}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="col-span-12 flex min-w-0 flex-col bg-white md:col-span-9">
        {selectedThread ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold leading-5 text-[#1F2937]">
                <MessageSquare className="h-4 w-4 text-(--brand-primary)" />
                SMS Messages
              </div>
              {selectedThread.messageCount > 0 ? (
                <span className="text-xs text-[#6B7280]">
                  Total{" "}
                  <span className="font-semibold text-[#111827]">{selectedThread.messageCount}</span>
                </span>
              ) : null}
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto bg-white px-5 py-4"
            >
              {loading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-[#6B7280]">
                  <Loader2 className="h-4 w-4 animate-spin text-(--brand-primary)" />
                  Loading messages...
                </div>
              ) : isPlaceholderThread(selectedThread) || selectedThread.messages.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)]">
                    <MessageSquare className="h-5 w-5 text-(--brand-primary)" />
                  </div>
                  <p className="text-sm font-medium text-[#374151]">No messages yet</p>
                  <p className="mt-1 max-w-xs text-xs text-[#6B7280]">
                    Send a text to {displayName} below.
                  </p>
                </div>
              ) : (
                selectedThread.messages.map((row) => (
                  <CommunicationMessageBubble key={row.id} row={row} contact={contact} />
                ))
              )}
            </div>

            <CommunicationThreadComposer
              channel="sms"
              replyBody={replyBody}
              replySubject={replySubject}
              sendingReply={sendingReply}
              sendError={sendError}
              sendSuccess={sendSuccess}
              onBodyChange={setReplyBody}
              onSubjectChange={setReplySubject}
              onSend={() => void sendSmsReply()}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-white text-sm text-[#6B7280]">
            Select a contact to view messages.
          </div>
        )}
      </main>
    </div>
  );

  const splitPane =
    inboxNav === "email" ? (
      <CandidateEmailInboxPanel
        workerId={workerId}
        candidateName={displayName}
        contact={contact}
        emailThreads={emailThreads}
        loading={loading}
        error={error}
        onRefresh={load}
      />
    ) : (
      smsSplitPane
    );

  const showInternalSubTabs = !hideSubTabs;

  const subTabs = showInternalSubTabs ? (
    <nav
      className="mb-4 grid grid-cols-[1fr_auto_1fr] items-end gap-4 px-5"
      aria-label="Inbox channels"
    >
      <div aria-hidden />
      <div className="flex items-end justify-center gap-x-8">
        <InboxChannelTabButtons active={inboxNav} onChange={setInboxNav} />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mb-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--brand-primary) bg-white px-3 text-xs font-semibold text-(--brand-primary) transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    </nav>
  ) : null;

  if (embedded) {
    return splitPane;
  }

  return (
    <section className="mb-4 mt-0 w-full min-w-0 rounded-lg border border-[#D1D5DB] bg-white">
      <div className="border-b border-[#E5E7EB] px-5 py-3">
        <h3 className="text-[16px] font-semibold text-[#111827]">Communication History</h3>
        <p className="mt-0.5 text-xs text-[#64748B]">SMS and email with this applicant.</p>
      </div>
      {subTabs}
      {splitPane}
    </section>
  );
}
