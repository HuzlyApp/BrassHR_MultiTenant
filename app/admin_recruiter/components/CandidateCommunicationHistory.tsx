"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, MessageSquare, RefreshCw, Send, X } from "lucide-react";
import {
  defaultReplySubject,
  type CommunicationThread,
} from "@/lib/communication/conversation";
import { communicationDirectionFromRow } from "@/lib/communication/direction";

type CommunicationRow = {
  id: string;
  channel: "email" | "sms";
  recipient: string;
  subject: string | null;
  body: string;
  status: "sent" | "failed" | "received";
  direction?: "inbound" | "outbound" | null;
  from_email?: string | null;
  to_email?: string | null;
  contact_email?: string | null;
  error_message: string | null;
  provider_message_id?: string | null;
  created_at: string;
  sent_by_user_id?: string | null;
};

type ContactInfo = {
  name: string;
  email: string | null;
  phone: string | null;
};

type CommunicationFilter = "all" | "sms" | "email";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function channelLabel(channel: CommunicationRow["channel"]): string {
  return channel === "sms" ? "SMS / Messages" : "Email";
}

function statusBadgeClass(status: CommunicationRow["status"]): string {
  if (status === "sent") return "bg-emerald-100 text-emerald-800";
  if (status === "received") return "bg-blue-100 text-blue-800";
  return "bg-red-100 text-red-800";
}

function threadContactLine(thread: CommunicationThread): string {
  if (thread.channel === "email") {
    return thread.contactEmail ?? "No email on file";
  }
  return thread.contactPhone ?? "No phone on file";
}

function senderDisplay(
  row: CommunicationRow,
  contact: ContactInfo | null,
  inbound: boolean
): string {
  if (row.channel === "email") {
    if (inbound) return row.from_email?.trim() || contact?.email || contact?.name || "Applicant";
    return row.from_email?.trim() || "notifications@brasshr.com";
  }
  return inbound ? contact?.name ?? contact?.phone ?? "Applicant" : "Recruiter";
}

function senderRole(inbound: boolean): string {
  return inbound ? "Applicant" : "Recruiter";
}

type Props = {
  workerId: string;
  refreshKey?: number;
};

export default function CandidateCommunicationHistory({ workerId, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [threads, setThreads] = useState<CommunicationThread[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [filter, setFilter] = useState<CommunicationFilter>("all");
  const [selectedThread, setSelectedThread] = useState<CommunicationThread | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(workerId)}/communications`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        communications?: CommunicationRow[];
        threads?: CommunicationThread[];
        contact?: ContactInfo;
        error?: string;
      };
      if (!res.ok) {
        setRows([]);
        setThreads([]);
        setError(json.error || `Failed to load (${res.status})`);
        return;
      }
      setRows(json.communications ?? []);
      setThreads(json.threads ?? []);
      setContact(json.contact ?? null);
    } catch {
      setRows([]);
      setThreads([]);
      setError("Could not load communication history.");
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filteredThreads = useMemo(() => {
    if (filter === "all") return threads;
    return threads.filter((thread) => thread.channel === filter);
  }, [filter, threads]);

  useEffect(() => {
    if (!selectedThread) return;
    const updated = threads.find((t) => t.conversationId === selectedThread.conversationId);
    if (updated) setSelectedThread(updated);
  }, [threads, selectedThread]);

  useEffect(() => {
    if (!selectedThread) return;
    setReplyBody("");
    setModalError(null);
    setModalSuccess(null);
    setReplySubject(
      selectedThread.channel === "email" ? defaultReplySubject(selectedThread) : ""
    );
  }, [selectedThread]);

  async function sendReply() {
    if (!selectedThread || !replyBody.trim()) return;
    setSendingReply(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const url =
        selectedThread.channel === "email"
          ? `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/email`
          : `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/sms`;
      const payload =
        selectedThread.channel === "email"
          ? { subject: replySubject.trim(), body: replyBody.trim() }
          : { body: replyBody.trim() };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ message: string }>;
      };
      if (!res.ok) {
        const detail =
          json.issues?.map((issue) => issue.message).join(" ") ||
          json.error ||
          `Send failed (${res.status})`;
        setModalError(detail);
        return;
      }
      setReplyBody("");
      setModalSuccess(
        selectedThread.channel === "email" ? "Email reply sent." : "SMS reply sent."
      );
      await load();
    } catch {
      setModalError("Network error. Please try again.");
    } finally {
      setSendingReply(false);
    }
  }

  const emailCount = threads.find((t) => t.channel === "email")?.messageCount ?? 0;
  const smsCount = threads.find((t) => t.channel === "sms")?.messageCount ?? 0;
  const totalMessageCount = rows.length;

  const filterTabs: Array<{ value: CommunicationFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: totalMessageCount },
    { value: "sms", label: "SMS / Messages", count: smsCount },
    { value: "email", label: "Email", count: emailCount },
  ];

  return (
    <section className="mx-auto mb-4 mt-0 w-full max-w-[1300px] rounded-lg border border-[#D1D5DB] bg-white">
      <div className="border-b border-[#E5E7EB] px-5 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#111827]">Communication History</h3>
            <p className="mt-1 text-xs text-slate-500">
              Conversations grouped by contact. Open a thread to read and reply in context.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex w-fit items-center gap-1 rounded-md border border-[#EAB308] px-3 py-1.5 text-xs font-semibold text-[#92400E] hover:bg-amber-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Communication type">
          {filterTabs.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[#D97706] bg-[#F59E0B] text-white shadow-sm"
                    : "border-amber-200 bg-white text-[#92400E] hover:bg-amber-50"
                }`}
              >
                {tab.label}
                <span className={active ? "ml-1 text-white/80" : "ml-1 text-amber-700/70"}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-800">No communication records yet.</p>
            <p className="mt-1 text-xs text-slate-500">Emails and SMS messages will appear here.</p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-800">No {filter === "sms" ? "SMS" : "email"} conversations.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredThreads.map((thread) => (
              <li key={thread.conversationId}>
                <button
                  type="button"
                  onClick={() => setSelectedThread(thread)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-left transition hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {thread.channel === "email" ? (
                      <Mail className="h-5 w-5 text-[#D97706]" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-[#D97706]" />
                    )}
                    <span className="font-semibold text-slate-900">{channelLabel(thread.channel)}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(thread.latestStatus)}`}>
                      {thread.latestStatus}
                    </span>
                    {thread.unreadCount > 0 ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {thread.unreadCount} received
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-slate-500">{formatShortWhen(thread.latestAt)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {contact?.name ?? "Applicant"} · {threadContactLine(thread)}
                  </p>
                  {thread.channel === "email" && thread.latestSubject ? (
                    <p className="mt-1 font-medium text-slate-800">{thread.latestSubject}</p>
                  ) : null}
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{thread.latestPreview}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedThread ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => !sendingReply && setSelectedThread(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="communication-thread-title"
            className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-[760px] sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedThread.channel === "email" ? (
                      <Mail className="h-5 w-5 text-[#D97706]" aria-hidden />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-[#D97706]" aria-hidden />
                    )}
                    <h4 id="communication-thread-title" className="font-semibold text-slate-900">
                      {channelLabel(selectedThread.channel)} with {contact?.name ?? "Applicant"}
                    </h4>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#92400E] ring-1 ring-amber-200">
                      {selectedThread.messageCount} message{selectedThread.messageCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {selectedThread.channel === "email"
                      ? `Contact: ${selectedThread.contactEmail ?? contact?.email ?? "—"}`
                      : `Contact: ${selectedThread.contactPhone ?? contact?.phone ?? "—"}`}
                  </p>
                  {selectedThread.rootSubject ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      Thread: {selectedThread.rootSubject}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading || sendingReply}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#92400E] hover:bg-amber-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedThread(null)}
                    disabled={sendingReply}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-white"
                    aria-label="Close conversation"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-5">
              {selectedThread.messages.map((row) => {
                const inbound = communicationDirectionFromRow(row) === "inbound";
                return (
                  <div key={row.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${
                        inbound
                          ? "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                          : "rounded-br-md bg-[#F59E0B] text-white"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <span>{senderRole(inbound)}</span>
                        <span className={inbound ? "font-normal text-slate-500" : "font-normal text-white/85"}>
                          {senderDisplay(row, contact, inbound)}
                        </span>
                        <span className={inbound ? "text-slate-400" : "text-white/75"}>
                          {formatWhen(row.created_at)}
                        </span>
                      </div>
                      {row.channel === "email" && row.subject ? (
                        <p className={`mb-2 font-semibold ${inbound ? "text-slate-900" : "text-white"}`}>
                          {row.subject}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap leading-6">{row.body}</p>
                      <div
                        className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] ${
                          inbound ? "text-slate-500" : "text-white/80"
                        }`}
                      >
                        <span>{row.status}</span>
                        {row.channel === "email" && row.to_email ? (
                          <span>{inbound ? `To: ${row.to_email}` : `To: ${row.to_email}`}</span>
                        ) : null}
                        {row.provider_message_id ? <span>ID: {row.provider_message_id}</span> : null}
                        {row.error_message ? (
                          <span className={inbound ? "text-red-600" : "text-red-100"}>
                            {row.error_message}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              {selectedThread.channel === "email" ? (
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Subject
                  <input
                    type="text"
                    value={replySubject}
                    onChange={(event) => setReplySubject(event.target.value)}
                    disabled={sendingReply}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                  />
                </label>
              ) : null}
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Reply message</span>
                  <textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    disabled={sendingReply}
                    rows={3}
                    placeholder={
                      selectedThread.channel === "sms"
                        ? "Write an SMS reply..."
                        : "Write an email reply..."
                    }
                    className="max-h-40 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#D97706] focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={
                    sendingReply ||
                    !replyBody.trim() ||
                    (selectedThread.channel === "email" && !replySubject.trim())
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F59E0B] px-4 text-sm font-semibold text-white hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">{sendingReply ? "Sending" : "Send"}</span>
                </button>
              </div>
              {modalError ? (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {modalError}
                </p>
              ) : null}
              {modalSuccess ? (
                <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {modalSuccess}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
