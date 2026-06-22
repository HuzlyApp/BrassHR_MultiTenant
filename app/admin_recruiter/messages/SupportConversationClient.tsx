"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download, Paperclip } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import ChatPendingAttachment from "@/app/components/ChatPendingAttachment";
import { formatChatTime } from "@/app/admin_recruiter/messages/chat-ui";
import { safeFetchJson } from "@/lib/api/safe-fetch-json";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { validateSupportTicketFile } from "@/lib/support-tickets/support-ticket-file-validation";
import type {
  SupportTicketAttachmentRow,
  SupportTicketMessageWithAttachments,
  SupportTicketStatus,
} from "@/lib/support-tickets/types";

const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";
const POLL_INTERVAL_MS = 15_000;

function attachmentUrl(attachmentId: string): string {
  return `/api/support-tickets/attachment?attachmentId=${encodeURIComponent(attachmentId)}`;
}

function isImageAttachment(attachment: SupportTicketAttachmentRow): boolean {
  const mime = (attachment.file_type ?? "").toLowerCase();
  return mime.startsWith("image/");
}

export default function SupportConversationClient({
  ticketId,
  viewerRole,
  counterpartyLabel = "Support",
  authHeaders,
  compact = false,
  ticketStatus,
}: {
  ticketId: string;
  viewerRole: "staff" | "applicant";
  counterpartyLabel?: string;
  authHeaders?: () => Promise<Record<string, string> | null>;
  compact?: boolean;
  ticketStatus?: SupportTicketStatus;
}) {
  const [messages, setMessages] = useState<SupportTicketMessageWithAttachments[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isClosed = ticketStatus === "Closed";

  const buildFetchInit = useCallback(
    async (init?: RequestInit): Promise<RequestInit> => {
      if (viewerRole === "applicant" && authHeaders) {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");
        return { ...init, headers: { ...init?.headers, ...headers } };
      }
      return { ...init, credentials: "include" };
    },
    [authHeaders, viewerRole]
  );

  const loadMessages = useCallback(async () => {
    const init = await buildFetchInit({ cache: "no-store" });
    const result = await safeFetchJson<{
      messages?: SupportTicketMessageWithAttachments[];
      error?: string;
    }>(`/api/support-tickets/${encodeURIComponent(ticketId)}/messages`, init);

    if (!result.ok) throw new Error(result.error);
    setMessages(result.data.messages ?? []);
  }, [buildFetchInit, ticketId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await loadMessages();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load messages.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadMessages]);

  useEffect(() => {
    if (loading || isClosed) return;
    const timer = window.setInterval(() => {
      void loadMessages().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isClosed, loadMessages, loading]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  function handleFileSelect(file: File | null) {
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
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isClosed) return;
    const text = body.trim();
    if (!text && !selectedFile) return;

    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      if (text) form.set("message", text);
      if (selectedFile) form.set("file", selectedFile);

      const init = await buildFetchInit({ method: "POST", body: form });
      const result = await safeFetchJson<{ message?: SupportTicketMessageWithAttachments; error?: string }>(
        `/api/support-tickets/${encodeURIComponent(ticketId)}/messages`,
        init
      );

      if (!result.ok) throw new Error(result.error);
      if (result.data.message) {
        setMessages((current) => [...current, result.data.message!]);
      } else {
        await loadMessages();
      }
      setBody("");
      setSelectedFile(null);
      setUploadError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className={
        compact
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
          : "mt-6 flex max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
      }
    >
      <div
        ref={scrollRef}
        className="flex min-h-[280px] flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {loading ? (
          <CandidateDetailLoader label="Loading messages..." className="min-h-0 flex-1 bg-transparent py-8" />
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="rounded-2xl bg-[#ECF1F9] px-4 py-3 text-sm text-[#64748B]">No messages yet.</p>
        ) : null}
        {!loading
          ? messages.map((message) => {
              const isOwn =
                viewerRole === "staff"
                  ? message.sender_role === "staff"
                  : message.sender_role === "applicant";
              const senderLabel = isOwn
                ? viewerRole === "staff"
                  ? "You"
                  : "You"
                : counterpartyLabel;

              return (
                <div
                  key={message.id}
                  className={`flex w-fit max-w-[78%] flex-col ${isOwn ? "ml-auto items-end" : "mr-auto items-start"}`}
                >
                  <p className="mb-1 text-[11px] font-medium text-[#94A3B8]">{senderLabel}</p>
                  <div
                    className="w-fit max-w-full rounded-2xl px-4 py-3 text-sm leading-6"
                    style={
                      isOwn
                        ? {
                            background:
                              "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                            color: "#ffffff",
                          }
                        : {
                            backgroundColor: "#ECF1F9",
                            color: "#1E293B",
                          }
                    }
                  >
                    {message.message !== "(attachment)" ? (
                      <p className="whitespace-pre-wrap wrap-break-word">{message.message}</p>
                    ) : null}
                    {message.attachments.length > 0 ? (
                      <div className={`space-y-2 ${message.message !== "(attachment)" ? "mt-2" : ""}`}>
                        {message.attachments.map((attachment) => (
                          <AttachmentChip
                            key={attachment.id}
                            attachment={attachment}
                            isOwn={isOwn}
                            viewerRole={viewerRole}
                            authHeaders={authHeaders}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] text-[#94A3B8]">{formatChatTime(message.created_at)}</p>
                </div>
              );
            })
          : null}
      </div>

      {error ? (
        <div className="border-t border-[#E8EDF2] px-5 py-2 text-sm text-red-600">{error}</div>
      ) : null}

      {isClosed ? (
        <div className="border-t border-[#E8EDF2] bg-[#F8FAFC] px-5 py-4 text-sm text-[#64748B]">
          This ticket is closed. Open a new ticket if you need more help.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-[#E8EDF2] bg-white px-5 py-4">
          {selectedFile ? (
            <div className="mb-3">
              <ChatPendingAttachment
                file={selectedFile}
                onRemove={() => handleFileSelect(null)}
              />
            </div>
          ) : null}
          {uploadError ? <p className="mb-2 text-xs text-red-600">{uploadError}</p> : null}
          <div className="flex items-end gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
              onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] transition hover:bg-[#F8FAFC] disabled:opacity-60"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
              placeholder="Type your reply..."
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-(--brand-primary)"
            />
            <button
              type="submit"
              disabled={sending || (!body.trim() && !selectedFile)}
              aria-label="Send"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              }}
            >
              <Image src={CHAT_SEND_ICON} alt="" width={20} height={20} className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function AttachmentChip({
  attachment,
  isOwn,
  viewerRole,
  authHeaders,
}: {
  attachment: SupportTicketAttachmentRow;
  isOwn: boolean;
  viewerRole: "staff" | "applicant";
  authHeaders?: () => Promise<Record<string, string> | null>;
}) {
  const url = attachmentUrl(attachment.id);
  const image = isImageAttachment(attachment);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!image || viewerRole !== "applicant") return;
    let alive = true;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const headers = authHeaders ? await authHeaders() : null;
        const token =
          headers?.Authorization?.replace(/^Bearer\s+/i, "") ??
          (await supabaseBrowser.auth.getSession()).data.session?.access_token;
        if (!token) return;

        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setPreviewUrl(objectUrl);
      } catch {
        if (alive) setPreviewUrl(null);
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authHeaders, image, url, viewerRole]);

  async function openAttachment() {
    try {
      if (viewerRole === "staff") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      const headers = authHeaders ? await authHeaders() : null;
      const token =
        headers?.Authorization?.replace(/^Bearer\s+/i, "") ??
        (await supabaseBrowser.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("You need to sign in again.");

      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not open file.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.file_name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      window.alert("Could not open attachment.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void openAttachment()}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
        isOwn ? "border-white/30 text-white hover:bg-white/10" : "border-[#CBD5E1] text-[#0F172A] hover:bg-white/80"
      }`}
    >
      {image && (viewerRole === "staff" || previewUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={viewerRole === "staff" ? url : previewUrl ?? undefined}
          alt=""
          className="h-8 w-8 rounded object-cover"
        />
      ) : (
        <Download className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{attachment.file_name}</span>
    </button>
  );
}
