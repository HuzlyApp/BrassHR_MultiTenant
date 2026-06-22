"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bot, X } from "lucide-react";
import type { ApplicantMessage } from "./types";
import { supabaseBrowser } from "@/lib/supabase-browser";
import ChatEmojiPicker from "@/app/components/ChatEmojiPicker";
import ChatImagePreviewModal from "@/app/components/ChatImagePreviewModal";
import { ChatAttachmentOptionsRow } from "@/app/application/components/applicant-portal/ChatAttachmentOptionsRow";
import { CreateSupportTicketModal } from "@/app/application/components/applicant-portal/CreateSupportTicketModal";

const CHAT_ATTACH_ICON = "/icons/chat-icons/attach_file.svg";
const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  messages: ApplicantMessage[];
  messageBody: string;
  sending: boolean;
  aiTyping?: boolean;
  recruiterDirectHint?: boolean;
  lastInquiry?: string;
  onMessageBodyChange: (value: string) => void;
  onSendMessage: (file?: File | null) => Promise<void>;
  onContactRecruiter?: () => void;
  authHeaders?: () => Promise<Record<string, string> | null>;
  onSupportTicketCreated?: (payload: { chatMessage?: ApplicantMessage }) => void;
};

function senderLabel(message: ApplicantMessage): string {
  if (message.sender_role === "ai") return message.sender_name ?? "AI Assistant";
  if (message.sender_role === "applicant") return "You";
  return "Recruiter";
}

export function ApplicantMessagesPanel({
  open,
  onClose,
  messages,
  messageBody,
  sending,
  aiTyping = false,
  recruiterDirectHint = false,
  lastInquiry = "",
  onMessageBodyChange,
  onSendMessage,
  onContactRecruiter,
  authHeaders,
  onSupportTicketCreated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketModalDefaults, setTicketModalDefaults] = useState({ subject: "", description: "" });
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    alt: string;
    revokeOnClose: boolean;
  } | null>(null);

  useEffect(() => {
    if (recruiterDirectHint && open) {
      messageInputRef.current?.focus();
    }
  }, [open, recruiterDirectHint]);

  function closeImagePreview() {
    if (previewImage?.revokeOnClose && previewImage.url.startsWith("blob:")) {
      URL.revokeObjectURL(previewImage.url);
    }
    setPreviewImage(null);
  }

  async function openImagePreview(message: ApplicantMessage) {
    if (message.message_type !== "image" || !message.attachment_path) return;
    try {
      const { blob } = await fetchAttachmentBlob(message);
      setPreviewImage({
        url: URL.createObjectURL(blob),
        alt: message.attachment_name ?? "Image",
        revokeOnClose: true,
      });
    } catch {
      window.alert("Could not open image. Please sign in again.");
    }
  }

  if (!open) return null;

  async function fetchAttachmentBlob(message: ApplicantMessage): Promise<{ blob: Blob; fileName: string }> {
    if (!message.attachment_path) throw new Error("Attachment not found.");
    const downloadUrl =
      message.attachment_url ??
      `/api/applicant-portal/messages/attachment?messageId=${encodeURIComponent(message.id)}`;
    const fileName = message.attachment_name ?? "attachment";
    const { data } = await supabaseBrowser.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("You need to sign in again.");

    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Could not open file.");
    return { blob: await response.blob(), fileName };
  }

  async function handleView(message: ApplicantMessage) {
    if (!message.attachment_path) return;
    if (message.message_type === "image") {
      await openImagePreview(message);
      return;
    }
    try {
      const { blob } = await fetchAttachmentBlob(message);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      window.alert("Could not open file. Please sign in again.");
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
      window.alert("Could not download file. Please sign in again.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSendMessage(selectedFile);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openTicketModal(inquiry: string) {
    const description = inquiry.trim();
    setTicketModalDefaults({
      subject: description ? description.split(/\n+/)[0]?.slice(0, 120) ?? "" : "",
      description,
    });
    setTicketModalOpen(true);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close messages"
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-[#E2E8F0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold text-[#012352]">Messages</h2>
            <p className="text-[13px] text-[#64748B]">Chat with your recruiter and AI assistant</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[14px] text-[#64748B] hover:bg-[#F8FAFC]"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <p className="rounded-lg bg-[#F8FAFC] px-4 py-3 text-[14px] text-[#64748B]">
              No messages yet. Ask a question and the AI assistant will help using your organization&apos;s help
              articles.
            </p>
          ) : null}
          {messages.map((message) => {
            const isApplicant = message.sender_role === "applicant";
            const isAi = message.sender_role === "ai";
            const buttons = message.metadata?.buttons ?? [];

            return (
              <div
                key={message.id}
                className={`group relative w-fit max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-5 ${
                  isApplicant
                    ? "ml-auto bg-(--brand-primary) text-white"
                    : isAi
                      ? "mr-auto border border-[#D9E3F2] bg-[#F8FAFC] text-[#1E293B]"
                      : "mr-auto bg-[#F1F5F9] text-[#374151]"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">
                  {isAi ? <Bot className="h-3.5 w-3.5" aria-hidden /> : null}
                  <span>
                    {senderLabel(message)} · {formatMessageTime(message.created_at)}
                  </span>
                </div>
                {message.body ? <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p> : null}
                {buttons.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {buttons.map((button) => (
                      <button
                        key={button.action}
                        type="button"
                        disabled={ticketModalOpen}
                        onClick={() => {
                          if (button.action === "message_recruiter") {
                            onContactRecruiter?.();
                            return;
                          }
                          openTicketModal(lastInquiry || message.body || "");
                        }}
                        className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.attachment_path ? (
                  <div
                    className={`mt-2 w-fit max-w-full rounded-lg border ${
                      isApplicant
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-[#D9E3F2] bg-white text-[#0F2F62]"
                    }`}
                  >
                    {message.message_type === "image" ? (
                      <button
                        type="button"
                        aria-label={`View ${message.attachment_name ?? "image"}`}
                        onClick={() => void openImagePreview(message)}
                        className="block w-full cursor-zoom-in overflow-hidden rounded-t-lg"
                      >
                        <AuthenticatedChatImage message={message} />
                      </button>
                    ) : null}
                    <ChatAttachmentOptionsRow
                      fileName={message.attachment_name ?? "Attachment"}
                      isApplicant={isApplicant}
                      isImage={message.message_type === "image"}
                      hasImageAbove={message.message_type === "image"}
                      isOpen={openMenuId === message.id}
                      onOpen={() => setOpenMenuId(message.id)}
                      onClose={() => setOpenMenuId(null)}
                      onView={() => void handleView(message)}
                      onDownload={() => void handleDownload(message)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          {aiTyping ? (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-[#D9E3F2] bg-[#F8FAFC] px-4 py-3 text-[13px] text-[#64748B]">
              <Bot className="h-4 w-4 shrink-0" aria-hidden />
              <span>AI Assistant is typing...</span>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-auto border-t border-[#E2E8F0] p-4">
          {recruiterDirectHint ? (
            <p className="mb-2 rounded-lg bg-[#EFF6FF] px-3 py-2 text-xs text-[#1D4ED8]">
              You can send this question directly to your recruiter here.
            </p>
          ) : null}
          {selectedFile ? (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155]">
              <span className="truncate pr-2">{selectedFile.name}</span>
              <button
                type="button"
                aria-label="Remove file"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#E2E8F0] text-[#64748B] transition hover:bg-[#CBD5E1]"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          <div className="flex w-full min-h-[60px] items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
            <textarea
              ref={messageInputRef}
              value={messageBody}
              onChange={(event) => onMessageBodyChange(event.target.value)}
              placeholder="Write message"
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
              <ChatEmojiPicker onSelect={(emoji) => onMessageBodyChange(messageBody + emoji)} />
              <button
                type="submit"
                disabled={sending || aiTyping || (!messageBody.trim() && !selectedFile)}
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
            }}
          />
        </form>
      </aside>

      <ChatImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url ?? null}
        alt={previewImage?.alt}
        onClose={closeImagePreview}
      />

      {authHeaders ? (
        <CreateSupportTicketModal
          open={ticketModalOpen}
          onClose={() => {
            setTicketModalOpen(false);
            setTicketModalDefaults({ subject: "", description: "" });
          }}
          defaultSubject={ticketModalDefaults.subject}
          defaultDescription={ticketModalDefaults.description}
          authHeaders={authHeaders}
          onSuccess={(payload) => {
            onSupportTicketCreated?.({ ticketId: payload.ticketId });
          }}
        />
      ) : null}
    </>
  );
}

function AuthenticatedChatImage({ message }: { message: ApplicantMessage }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const downloadUrl =
          message.attachment_url ??
          `/api/applicant-portal/messages/attachment?messageId=${encodeURIComponent(message.id)}`;
        const { data } = await supabaseBrowser.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const response = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setImageUrl(objectUrl);
      } catch {
        if (alive) setImageUrl(null);
      }
    })();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.attachment_url, message.id]);

  if (!imageUrl) {
    return (
      <div className="flex h-[120px] w-[200px] items-center justify-center bg-white/10 text-xs opacity-80">
        Loading...
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={message.attachment_name ?? "Image attachment"}
      className="max-h-[180px] max-w-[240px] object-cover"
    />
  );
}
