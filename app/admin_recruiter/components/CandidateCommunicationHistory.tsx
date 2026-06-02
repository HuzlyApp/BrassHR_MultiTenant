"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Mail, MessageSquare, RefreshCw, Send, X } from "lucide-react";

type CommunicationRow = {
  id: string;
  channel: "email" | "sms";
  recipient: string;
  subject: string | null;
  body: string;
  status: "sent" | "failed";
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

function communicationDirection(row: CommunicationRow): "outbound" | "inbound" {
  const subject = row.subject?.trim().toLowerCase() ?? "";
  if (subject.startsWith("inbound") || subject.includes("reply")) return "inbound";
  return "outbound";
}

function channelLabel(channel: CommunicationRow["channel"]): string {
  return channel === "sms" ? "SMS / Messages" : "Email";
}

function previewText(row: CommunicationRow): string {
  const text = row.body.replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

type Props = {
  workerId: string;
  refreshKey?: number;
};

export default function CandidateCommunicationHistory({ workerId, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [filter, setFilter] = useState<CommunicationFilter>("all");
  const [selected, setSelected] = useState<CommunicationRow | null>(null);
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
        contact?: ContactInfo;
        error?: string;
      };
      if (!res.ok) {
        setRows([]);
        setError(json.error || `Failed to load (${res.status})`);
        return;
      }
      setRows(json.communications ?? []);
      setContact(json.contact ?? null);
    } catch {
      setRows([]);
      setError("Could not load communication history.");
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.channel === filter);
  }, [filter, rows]);

  const selectedChannelRows = useMemo(() => {
    if (!selected) return [];
    return rows
      .filter((row) => row.channel === selected.channel)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [rows, selected]);

  const selectedContact = selected?.channel === "email" ? contact?.email : contact?.phone;

  useEffect(() => {
    if (!selected) return;
    const updated = rows.find((row) => row.id === selected.id);
    if (updated) setSelected(updated);
  }, [rows, selected]);

  useEffect(() => {
    if (!selected) return;
    setReplyBody("");
    setModalError(null);
    setModalSuccess(null);
    setReplySubject(
      selected.channel === "email"
        ? selected.subject?.trim().toLowerCase().startsWith("re:")
          ? selected.subject
          : `Re: ${selected.subject?.trim() || "Application status"}`
        : ""
    );
  }, [selected]);

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setSendingReply(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const url =
        selected.channel === "email"
          ? `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/email`
          : `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/sms`;
      const payload =
        selected.channel === "email"
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
      setModalSuccess(selected.channel === "email" ? "Email reply sent." : "SMS reply sent.");
      await load();
    } catch {
      setModalError("Network error. Please try again.");
    } finally {
      setSendingReply(false);
    }
  }

  const filterTabs: Array<{ value: CommunicationFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: rows.length },
    { value: "sms", label: "SMS / Messages", count: rows.filter((row) => row.channel === "sms").length },
    { value: "email", label: "Email", count: rows.filter((row) => row.channel === "email").length },
  ];

  return (
    <section className="mx-auto mb-4 mt-0 w-full max-w-[1300px] rounded-lg border border-[#D1D5DB] bg-white">
      <div className="border-b border-[#E5E7EB] px-5 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#111827]">Communication History</h3>
            <p className="mt-1 text-xs text-slate-500">
              Filter messages, open a thread, and continue the conversation.
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
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-800">No communication records yet.</p>
            <p className="mt-1 text-xs text-slate-500">Emails and SMS messages will appear here.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-800">No {filter === "sms" ? "SMS" : "email"} records.</p>
            <p className="mt-1 text-xs text-slate-500">Try a different communication filter.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {filteredRows.map((row) => {
              const inbound = communicationDirection(row) === "inbound";
              return (
              <li
                key={row.id}
                className="group"
              >
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-left text-sm transition hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {row.channel === "email" ? (
                      <Mail className="h-4 w-4 text-[#D97706]" aria-hidden />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-[#D97706]" aria-hidden />
                    )}
                    <span className="font-semibold text-slate-900">{channelLabel(row.channel)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === "sent"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {row.status}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        inbound ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {inbound ? "Applicant" : "Recruiter"}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">{formatShortWhen(row.created_at)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {inbound ? "From" : "To"}: {row.recipient}
                  </p>
                  {row.subject ? (
                    <p className="mt-1 line-clamp-1 font-medium text-slate-800">{row.subject}</p>
                  ) : null}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-slate-700">
                    {previewText(row)}
                  </p>
                  {row.error_message ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {row.error_message}
                    </p>
                  ) : null}
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => !sendingReply && setSelected(null)}
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
                    {selected.channel === "email" ? (
                      <Mail className="h-5 w-5 text-[#D97706]" aria-hidden />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-[#D97706]" aria-hidden />
                    )}
                    <h4 id="communication-thread-title" className="font-semibold text-slate-900">
                      {channelLabel(selected.channel)} with {contact?.name ?? "Applicant"}
                    </h4>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#92400E] ring-1 ring-amber-200">
                      {selectedChannelRows.length} record{selectedChannelRows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {selectedContact ? `Contact: ${selectedContact}` : "No contact value on file"}
                  </p>
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
                    onClick={() => setSelected(null)}
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
              {loading && selectedChannelRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading conversation…
                </div>
              ) : selectedChannelRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-amber-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No conversation records found.
                </div>
              ) : (
                selectedChannelRows.map((row) => {
                  const direction = communicationDirection(row);
                  const inbound = direction === "inbound";
                  return (
                    <div
                      key={row.id}
                      className={`flex ${inbound ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${
                          inbound
                            ? "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                            : "rounded-br-md bg-[#F59E0B] text-white"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                          <span>{inbound ? contact?.name ?? "Applicant" : "Recruiter"}</span>
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
                })
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              {selected.channel === "email" ? (
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
                      selected.channel === "sms"
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
                    (selected.channel === "email" && !replySubject.trim())
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
