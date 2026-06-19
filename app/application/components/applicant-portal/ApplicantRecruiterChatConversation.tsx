"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bot } from "lucide-react";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import ChatEmojiPicker from "@/app/components/ChatEmojiPicker";
import ChatImagePreviewModal from "@/app/components/ChatImagePreviewModal";
import { ChatAttachmentOptionsRow } from "@/app/application/components/applicant-portal/ChatAttachmentOptionsRow";
import type { ApplicantMessage } from "./types";
import type { ApplicantPortalMessaging } from "./ApplicantPortalProvider";
import { supabaseBrowser } from "@/lib/supabase-browser";

const CHAT_ATTACH_ICON = "/icons/chat-icons/attach_file.svg";
const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

function MessageAvatar({ name, variant }: { name: string; variant: "primary" | "accent" }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={
        variant === "primary"
          ? {
              background:
                "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              color: "#ffffff",
            }
          : {
              backgroundColor: "#ECF1F9",
              color: "#334155",
            }
      }
    >
      {nameInitials(name)}
    </div>
  );
}

function senderLabel(message: ApplicantMessage): string {
  if (message.sender_role === "ai") return message.sender_name ?? "AI Assistant";
  if (message.sender_role === "applicant") return "You";
  return "Recruiter";
}

type Props = {
  messaging: ApplicantPortalMessaging;
  recruiterName: string;
  workerName: string;
};

export function ApplicantRecruiterChatConversation({ messaging, recruiterName, workerName }: Props) {
  const branding = useTenantBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [ticketPending, setTicketPending] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    alt: string;
    revokeOnClose: boolean;
  } | null>(null);

  const {
    messages,
    messageBody,
    setMessageBody,
    sending,
    aiTyping,
    recruiterDirectHint,
    lastInquiry,
    onSendMessage,
    onContactRecruiter,
    onCreateSupportTicket,
  } = messaging;

  const displayRecruiterName = branding.companyName?.trim() || recruiterName;

  useEffect(() => {
    if (recruiterDirectHint) {
      messageInputRef.current?.focus();
    }
  }, [recruiterDirectHint]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, aiTyping]);

  function closeImagePreview() {
    if (previewImage?.revokeOnClose && previewImage.url.startsWith("blob:")) {
      URL.revokeObjectURL(previewImage.url);
    }
    setPreviewImage(null);
  }

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

  async function handleTicketClick(inquiry: string) {
    if (ticketPending) return;
    setTicketPending(true);
    try {
      await onCreateSupportTicket(inquiry);
    } finally {
      setTicketPending(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="flex min-h-[320px] flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {messages.length === 0 ? (
            <p className="rounded-2xl bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
              No messages yet. Ask a question and your recruiter or AI assistant will help.
            </p>
          ) : null}

          {messages.map((message) => {
            const isApplicant = message.sender_role === "applicant";
            const isAi = message.sender_role === "ai";
            const senderLabelText = isApplicant ? "You" : isAi ? senderLabel(message) : displayRecruiterName;
            const avatarName = isApplicant ? workerName : senderLabelText;
            const buttons = message.metadata?.buttons ?? [];

            return (
              <div
                key={message.id}
                className={`flex w-fit max-w-[78%] flex-col ${isApplicant ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <div
                  className={`group relative w-fit max-w-full rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.attachment_path ? "pr-10" : ""
                  }`}
                  style={
                    isApplicant
                      ? {
                          background:
                            "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                          color: "#ffffff",
                        }
                      : isAi
                        ? {
                            backgroundColor: "#F8FAFC",
                            color: "#1E293B",
                            border: "1px solid #D9E3F2",
                          }
                        : {
                            backgroundColor: "#ECF1F9",
                            color: "#1E293B",
                          }
                  }
                >
                  {message.body ? <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p> : null}
                  {buttons.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {buttons.map((button) => (
                        <button
                          key={button.action}
                          type="button"
                          disabled={ticketPending}
                          onClick={() => {
                            if (button.action === "message_recruiter") {
                              onContactRecruiter();
                              return;
                            }
                            void handleTicketClick(lastInquiry || message.body || "");
                          }}
                          className="rounded-full border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ticketPending && button.action === "create_support_ticket"
                            ? "Please wait..."
                            : button.label}
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
                <div className={`mt-2 flex items-center gap-2 ${isApplicant ? "flex-row-reverse" : ""}`}>
                  {isAi ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[#475569]">
                      <Bot className="h-4 w-4" aria-hidden />
                    </div>
                  ) : (
                    <MessageAvatar name={avatarName} variant={isApplicant ? "primary" : "accent"} />
                  )}
                  <p className="text-xs text-[#64748B]">
                    <span className="font-medium text-[#334155]">{senderLabelText}</span>
                    {" · "}
                    {formatChatTime(message.created_at)}
                  </p>
                </div>
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

        <form onSubmit={handleSubmit} className="border-t border-[#E8EDF2] bg-white px-5 py-4">
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
                className="rounded-md px-2 py-1 text-[#64748B] hover:bg-[#E2E8F0]"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex min-h-[60px] w-full items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
            <textarea
              ref={messageInputRef}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
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
                <Image src={CHAT_ATTACH_ICON} alt="" width={24} height={24} className="h-6 w-6 shrink-0" aria-hidden />
              </button>
              <ChatEmojiPicker onSelect={(emoji) => setMessageBody(messageBody + emoji)} />
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
                <Image src={CHAT_SEND_ICON} alt="" width={16} height={16} className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </form>
      </div>

      <ChatImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url ?? null}
        alt={previewImage?.alt}
        onClose={closeImagePreview}
      />
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
