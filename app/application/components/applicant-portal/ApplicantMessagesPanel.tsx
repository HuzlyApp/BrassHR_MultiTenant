"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download, Eye, MoreVertical, X } from "lucide-react";
import type { ApplicantMessage } from "./types";
import { supabaseBrowser } from "@/lib/supabase-browser";

const CHAT_ATTACH_ICON = "/icons/chat-icons/attach_file.svg";
const CHAT_EMOJI_ICON = "/icons/chat-icons/emoji-happy.svg";
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
  onMessageBodyChange: (value: string) => void;
  onSendMessage: (file?: File | null) => Promise<void>;
};

export function ApplicantMessagesPanel({
  open,
  onClose,
  messages,
  messageBody,
  sending,
  onMessageBodyChange,
  onSendMessage,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
            <p className="text-[13px] text-[#64748B]">Chat with your recruiter</p>
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
              No messages yet. Send your first question to the recruiter.
            </p>
          ) : null}
          {messages.map((message) => {
            const isApplicant = message.sender_role === "applicant";
            return (
              <div
                key={message.id}
                className={`group relative w-fit max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-5 ${
                  isApplicant
                    ? "ml-auto bg-(--brand-primary) text-white"
                    : "mr-auto bg-[#F1F5F9] text-[#374151]"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">
                  {isApplicant ? "You" : "Recruiter"} · {formatMessageTime(message.created_at)}
                </p>
                {message.body ? <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p> : null}
                {message.attachment_path ? (
                  <div
                    ref={openMenuId === message.id ? menuRef : undefined}
                    className={`relative mt-2 flex min-w-[140px] max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                      isApplicant
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-[#D9E3F2] bg-white text-[#0F2F62]"
                    }`}
                  >
                    <p className="min-w-0 flex-1 truncate pr-1">
                      {message.attachment_name ?? "Attachment"}
                    </p>
                    <button
                      type="button"
                      aria-label="File options"
                      aria-expanded={openMenuId === message.id}
                      onClick={() =>
                        setOpenMenuId((current) => (current === message.id ? null : message.id))
                      }
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 ${
                        openMenuId === message.id ? "opacity-100" : ""
                      } ${
                        isApplicant
                          ? "text-white hover:bg-white/15"
                          : "text-[#64748B] hover:bg-[#F1F5F9]"
                      }`}
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden />
                    </button>
                    {openMenuId === message.id ? (
                      <div
                        className={`absolute bottom-full right-0 z-20 mb-1 min-w-[130px] overflow-hidden rounded-lg border shadow-lg ${
                          isApplicant
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
                            isApplicant ? "hover:bg-white/10" : "hover:bg-[#F8FAFC]"
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
                            isApplicant
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
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-auto border-t border-[#E2E8F0] p-4">
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
                disabled={sending || (!messageBody.trim() && !selectedFile)}
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
    </>
  );
}
