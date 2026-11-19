"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Circle, MoreVertical, Paperclip, Ticket, X } from "lucide-react";
import SupportConversationClient from "@/app/admin_recruiter/messages/SupportConversationClient";
import ChatPendingAttachment from "@/app/components/ChatPendingAttachment";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { safeFetchJson } from "@/lib/api/safe-fetch-json";
import { relativeChatMinutes } from "@/lib/messaging/group-conversations";
import { validateSupportTicketFile } from "@/lib/support-tickets/support-ticket-file-validation";
import { formatSupportTicketNumber } from "@/lib/support-tickets/ticket-number";
import type { SupportTicketConversationItem } from "@/lib/support-tickets/types";

const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

type Props = {
  ticket: SupportTicketConversationItem | null;
  open: boolean;
  onClose: () => void;
  authHeaders: () => Promise<Record<string, string> | null>;
};

type ModalView = "overview" | "chat";

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "closed" || normalized === "resolved") return "text-[#64748B]";
  if (normalized === "in progress") return "text-[#2563EB]";
  return "text-[#16A34A]";
}

function formatCategory(value: string | null | undefined): string {
  const text = (value ?? "general").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function WorkerTicketDetailModal({ ticket, open, onClose, authHeaders }: Props) {
  const branding = useTenantBranding();
  const secondaryColor = branding.secondaryHex || "#012352";
  const [view, setView] = useState<ModalView>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickReply, setQuickReply] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setView("overview");
    setMenuOpen(false);
    setQuickReply("");
    setSelectedFile(null);
    setUploadError(null);
    setReplyError(null);
  }, [open, ticket?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (view === "chat") {
          setView("overview");
          return;
        }
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, view]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-ticket-menu]")) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  if (!open || !ticket) return null;

  const ticketLabel = formatSupportTicketNumber(ticket.ticket_number, ticket.id);
  const isClosed = ticket.status === "Closed";
  const relativeRaw = relativeChatMinutes(
    ticket.lastMessageAt || ticket.updated_at || ticket.created_at
  );
  const relativeTime = relativeRaw
    ? relativeRaw.replace(/(\d+)m\b/, "$1 min").replace(/(\d+)h\b/, "$1 hr").replace(/(\d+)d\b/, "$1 day")
    : "Just now";

  function openChat() {
    setMenuOpen(false);
    setView("chat");
    window.setTimeout(() => {
      chatAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

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

  async function handleQuickReply(event: FormEvent) {
    event.preventDefault();
    if (!ticket || isClosed || sending) return;
    const ticketId = ticket.id;
    const text = quickReply.trim();
    if (!text && !selectedFile) return;

    setSending(true);
    setReplyError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const form = new FormData();
      if (text) form.set("message", text);
      if (selectedFile) form.set("file", selectedFile);

      const result = await safeFetchJson<{ error?: string }>(
        `/api/support-tickets/${encodeURIComponent(ticketId)}/messages`,
        { method: "POST", headers, body: form }
      );
      if (!result.ok) throw new Error(result.error);

      setQuickReply("");
      setSelectedFile(null);
      setUploadError(null);
      openChat();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-ticket-detail-title"
        className="flex max-h-[min(92vh,820px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <h2
            id="worker-ticket-detail-title"
            className="text-[22px] font-semibold leading-7 text-[#0F172A]"
          >
            My Ticket
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:brightness-110"
            style={{ backgroundColor: secondaryColor }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {view === "chat" ? (
          <div ref={chatAnchorRef} className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setView("overview")}
                className="text-sm font-semibold underline-offset-2 hover:underline"
                style={{ color: secondaryColor }}
              >
                Back to ticket
              </button>
              <p className="truncate text-xs font-medium text-[#64748B]">{ticketLabel}</p>
            </div>
            <div className="min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-[#E5E7EB]">
              <SupportConversationClient
                ticketId={ticket.id}
                viewerRole="applicant"
                counterpartyLabel="Support team"
                authHeaders={authHeaders}
                compact
                ticketStatus={ticket.status}
              />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: secondaryColor }}
                >
                  <Ticket className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#0F172A]">
                        {ticket.subject ?? "Support request"}
                      </p>
                      <p className="mt-0.5 text-sm text-[#94A3B8]">{relativeTime}</p>
                    </div>
                    <div className="relative shrink-0" data-ticket-menu>
                      <button
                        type="button"
                        aria-label="Ticket actions"
                        aria-expanded={menuOpen}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuOpen((current) => !current);
                        }}
                        className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </button>
                      {menuOpen ? (
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={openChat}
                            className="flex w-full px-3 py-2.5 text-left text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]"
                          >
                            Chat with Support
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusTone(ticket.status)}`}
                    >
                      <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
                      {ticket.status}
                    </span>
                    <span className="text-sm text-[#64748B]">
                      {formatCategory(ticket.category)} · {ticket.priority} priority
                    </span>
                    <span className="text-sm font-semibold" style={{ color: secondaryColor }}>
                      {ticketLabel}
                    </span>
                  </div>
                </div>
              </div>

              {ticket.description ? (
                <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#334155]">
                  {ticket.description}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#64748B]">No description provided.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-base font-semibold text-[#0F172A]">Quick Reply</p>
              {isClosed ? (
                <p className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
                  This ticket is closed. Open a new ticket if you need more help.
                </p>
              ) : (
                <form onSubmit={(event) => void handleQuickReply(event)} className="space-y-3">
                  {selectedFile ? (
                    <ChatPendingAttachment
                      file={selectedFile}
                      onRemove={() => handleFileSelect(null)}
                    />
                  ) : null}
                  {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
                  {replyError ? <p className="text-xs text-red-600">{replyError}</p> : null}
                  <div className="relative rounded-xl border border-[#CBD5E1] bg-white focus-within:border-[color:var(--brand-secondary,#012352)]">
                    <textarea
                      value={quickReply}
                      onChange={(event) => setQuickReply(event.target.value)}
                      rows={4}
                      placeholder="Write a message"
                      className="min-h-[96px] w-full resize-none rounded-xl bg-transparent px-3.5 py-3 pr-28 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                    />
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
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
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] disabled:opacity-60"
                      >
                        <Paperclip className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="submit"
                        disabled={sending || (!quickReply.trim() && !selectedFile)}
                        aria-label="Send"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        <Image
                          src={CHAT_SEND_ICON}
                          alt=""
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px]"
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-[#E5E7EB]" />
              <span className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">OR</span>
              <div className="h-px flex-1 bg-[#E5E7EB]" />
            </div>

            <button
              type="button"
              onClick={openChat}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-3 text-base font-semibold text-white transition hover:brightness-95"
              style={{ backgroundColor: secondaryColor }}
            >
              Chat with Support
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
