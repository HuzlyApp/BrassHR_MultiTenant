"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download, Eye, MoreVertical } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import ChatPendingAttachment from "@/app/components/ChatPendingAttachment";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import {
  mergeApplicantMessage,
  sortApplicantMessages,
  type ApplicantMessage,
} from "@/lib/messaging/applicant-messages";
import { useApplicantMessagesRealtime } from "@/lib/messaging/useApplicantMessagesRealtime";

const CHAT_ATTACH_ICON = "/icons/chat-icons/attach_file.svg";
const CHAT_EMOJI_ICON = "/icons/chat-icons/emoji-happy.svg";
const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

function ChatAvatar({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "accent";
}) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={
        variant === "primary"
          ? {
              background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              color: "#ffffff",
            }
          : {
              background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-accent) 70%, white) 0%, color-mix(in srgb, var(--brand-primary) 20%, white) 100%)",
              color: "var(--brand-secondary)",
            }
      }
    >
      {nameInitials(label)}
    </div>
  );
}

export default function ApplicantConversationClient({
  workerId,
  compact = false,
  applicantName = "Applicant",
  showHeader = true,
}: {
  workerId: string;
  compact?: boolean;
  applicantName?: string;
  showHeader?: boolean;
}) {
  const branding = useTenantBranding();
  const recruiterLabel = branding.companyName?.trim() || "Recruiter";
  const [messages, setMessages] = useState<ApplicantMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/applicant-portal/messages?workerId=${encodeURIComponent(workerId)}`, {
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as { messages?: ApplicantMessage[]; error?: string };
    if (!res.ok) throw new Error(payload.error || "Could not load messages.");
    setMessages(sortApplicantMessages(payload.messages ?? []));
  }, [workerId]);

  useApplicantMessagesRealtime(workerId, setMessages, !loading);

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
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = body.trim();
    if (!message && !selectedFile) return;

    setSending(true);
    setError(null);
    try {
      const payloadBody = new FormData();
      payloadBody.append("workerId", workerId);
      if (message) payloadBody.append("body", message);
      if (selectedFile) payloadBody.append("file", selectedFile);
      const res = await fetch("/api/applicant-portal/messages", {
        method: "POST",
        body: payloadBody,
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: ApplicantMessage;
      };
      if (!res.ok) throw new Error(payload.error || "Could not send reply.");

      setBody("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (payload.message) {
        setMessages((current) => mergeApplicantMessage(current, payload.message!));
      } else {
        await loadMessages();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  function attachmentUrl(message: ApplicantMessage): string {
    return (
      message.attachment_url ??
      `/api/applicant-portal/messages/attachment?messageId=${encodeURIComponent(message.id)}`
    );
  }

  async function fetchAttachmentBlob(message: ApplicantMessage): Promise<{ blob: Blob; fileName: string }> {
    if (!message.attachment_path) throw new Error("Attachment not found.");
    const response = await fetch(attachmentUrl(message));
    if (!response.ok) throw new Error("Could not open file.");
    return { blob: await response.blob(), fileName: message.attachment_name ?? "attachment" };
  }

  async function handleView(message: ApplicantMessage) {
    if (!message.attachment_path) return;
    try {
      const { blob } = await fetchAttachmentBlob(message);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      window.alert("Could not open file.");
    }
  }

  async function handleDownload(message: ApplicantMessage) {
    if (!message.attachment_path) return;
    try {
      const { blob, fileName } = await fetchAttachmentBlob(message);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.alert("Could not download file.");
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
      {!compact && showHeader ? (
        <div className="border-b border-[#E8EDF2] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">{applicantName}</h2>
          <p className="mt-1 text-sm text-[#64748B]">Applicant conversation</p>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex min-h-[280px] flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {loading ? (
          <CandidateDetailLoader label="Loading messages..." className="min-h-0 flex-1 bg-transparent py-8" />
        ) : null}
        {!loading && messages.length === 0 ? (
          <p
            className="rounded-2xl px-4 py-3 text-sm text-[#64748B]"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 18%, white)" }}
          >
            No applicant messages yet.
          </p>
        ) : null}
        {!loading
          ? messages.map((message) => {
          const isRecruiter = message.sender_role === "recruiter";
          const senderName = isRecruiter ? recruiterLabel : applicantName;
          return (
            <div
              key={message.id}
              className={`flex w-fit max-w-[78%] flex-col ${isRecruiter ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <div
                className={`group relative w-fit max-w-full rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.attachment_path ? "pr-10" : ""
                }`}
                style={
                  isRecruiter
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
                {message.attachment_path ? (
                  <div
                    ref={openMenuId === message.id ? menuRef : undefined}
                    className="absolute right-2 top-2"
                  >
                    <button
                      type="button"
                      aria-label="File options"
                      aria-expanded={openMenuId === message.id}
                      onClick={() =>
                        setOpenMenuId((current) => (current === message.id ? null : message.id))
                      }
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 ${
                        openMenuId === message.id ? "opacity-100" : ""
                      } ${
                        isRecruiter
                          ? "text-white hover:bg-white/15"
                          : "text-[#64748B] hover:bg-white/70"
                      }`}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </button>
                    {openMenuId === message.id ? (
                      <div
                        className={`absolute right-0 top-full z-20 mt-1 min-w-[130px] overflow-hidden rounded-lg border shadow-lg ${
                          isRecruiter
                            ? "border-white/20 bg-[#0F172A] text-white"
                            : "border-[#E2E8F0] bg-white text-[#0F2F62]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            void handleView(message);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium ${
                            isRecruiter ? "hover:bg-white/10" : "hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {message.message_type === "image" ? "View" : "Open"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            void handleDownload(message);
                          }}
                          className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-[13px] font-medium ${
                            isRecruiter
                              ? "border-white/10 hover:bg-white/10"
                              : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Download
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {message.body ? <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p> : null}
                {message.attachment_path ? (
                  <div
                    className={`mt-2 w-fit max-w-full overflow-hidden rounded-lg border ${
                      isRecruiter
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-[#D9E3F2] bg-white text-[#0F2F62]"
                    }`}
                  >
                    {message.message_type === "image" ? (
                      <img
                        src={attachmentUrl(message)}
                        alt={message.attachment_name ?? "Image attachment"}
                        className="max-h-[180px] max-w-[240px] object-cover"
                      />
                    ) : null}
                    <div className="px-3 py-2 text-xs font-medium">
                      <p className="max-w-[220px] truncate">{message.attachment_name ?? "Attachment"}</p>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className={`mt-2 flex items-center gap-2 ${isRecruiter ? "flex-row-reverse" : ""}`}>
                <ChatAvatar label={senderName} variant={isRecruiter ? "primary" : "accent"} />
                <p className="text-xs text-[#64748B]">
                  <span className="font-medium text-[#334155]">{senderName}</span>
                  {" · "}
                  {formatChatTime(message.created_at)}
                </p>
              </div>
            </div>
          );
        })
          : null}
      </div>

      <form onSubmit={handleSend} className="border-t border-[#E8EDF2] bg-white px-5 py-4">
        {error ? (
          <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}
        {selectedFile ? (
          <ChatPendingAttachment
            file={selectedFile}
            removeLabel="Delete attachment"
            className="mb-2 flex items-center justify-between rounded-md border border-[#D8E0EA] bg-white px-3 py-2 text-xs text-[#334155]"
            onRemove={() => {
              setSelectedFile(null);
              setError(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        ) : null}
        <div className="flex w-full min-h-[60px] items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
          <textarea
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Write a message"
            rows={1}
            className="h-[54px] min-h-[54px] flex-1 resize-none border-0 bg-transparent py-[4px] text-sm leading-5 text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Attach file"
              className="inline-flex h-6 w-6 items-center justify-center transition hover:opacity-80"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image
                src={CHAT_ATTACH_ICON}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
                aria-hidden
              />
            </button>
            <button
              type="button"
              aria-label="Add emoji"
              className="inline-flex h-6 w-6 items-center justify-center transition hover:opacity-80"
            >
              <Image
                src={CHAT_EMOJI_ICON}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
                aria-hidden
              />
            </button>
            <button
              type="submit"
              disabled={sending || (!body.trim() && !selectedFile)}
              aria-label="Send message"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              }}
            >
              <Image
                src={CHAT_SEND_ICON}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 shrink-0"
                aria-hidden
              />
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setSelectedFile(next);
            if (error) setError(null);
          }}
        />
      </form>
    </section>
  );
}
