"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, Minus, MoreVertical } from "lucide-react";
import Link from "next/link";
import ApplicantConversationClient from "@/app/admin_recruiter/messages/ApplicantConversationClient";
import { nameInitials } from "@/app/admin_recruiter/messages/chat-ui";

type ChatPanelMode = "minimized" | "expanded";

type CandidateChatPopupProps = {
  workerId: string;
  candidateName: string;
  /** Optional label shown above empty chat, e.g. "Applied on July 22" */
  appliedOnLabel?: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Expand immediately when opened from header Chat button */
  preferExpanded?: boolean;
};

function ChatHeaderAvatar({ name }: { name: string }) {
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
      aria-hidden
    >
      {nameInitials(name)}
    </span>
  );
}

/**
 * Bottom-right chat dock for candidate details — minimized bar + expanded panel.
 * Reuses ApplicantConversationClient for send/load/realtime.
 */
export default function CandidateChatPopup({
  workerId,
  candidateName,
  appliedOnLabel = null,
  open = true,
  onOpenChange,
  preferExpanded = false,
}: CandidateChatPopupProps) {
  const [mode, setMode] = useState<ChatPanelMode>(preferExpanded ? "expanded" : "minimized");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setMenuOpen(false);
      return;
    }
    if (preferExpanded) setMode("expanded");
  }, [open, preferExpanded]);

  const displayName = candidateName.trim() || "Applicant";
  const messagesHref = useMemo(
    () => `/admin_recruiter/messages/${encodeURIComponent(workerId)}`,
    [workerId]
  );

  if (!workerId || !open) return null;

  if (mode === "minimized") {
    return (
      <div className="fixed bottom-0 right-0 z-[60] w-[calc(100%-var(--admin-sidebar-collapsed-width-mobile,48px))] max-w-[320px] md:max-w-[360px] sm:right-6">
        <div
          className="flex h-12 items-center justify-between gap-2 rounded-t-lg px-3 shadow-lg"
          style={{ background: "var(--brand-secondary)" }}
        >
          <button
            type="button"
            onClick={() => setMode("expanded")}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-label={`Open chat with ${displayName}`}
          >
            <ChatHeaderAvatar name={displayName} />
            <span className="truncate text-sm font-medium text-white">{displayName}</span>
          </button>
          <div className="relative flex shrink-0 items-center gap-0.5 text-white">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
              aria-label="Chat options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute bottom-full right-0 z-10 mb-1 min-w-[160px] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg">
                <Link
                  href={messagesHref}
                  className="block px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                  onClick={() => setMenuOpen(false)}
                >
                  Open full chat
                </Link>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenChange?.(false);
                  }}
                >
                  Close
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
              aria-label="Expand chat"
              onClick={() => {
                setMenuOpen(false);
                setMode("expanded");
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-[60] flex h-[min(560px,85dvh)] w-full max-w-[380px] flex-col overflow-hidden rounded-t-xl border border-[#E5E7EB] bg-white shadow-2xl sm:right-6">
      <div
        className="flex h-12 shrink-0 items-center justify-between gap-2 px-3"
        style={{ background: "var(--brand-secondary)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ChatHeaderAvatar name={displayName} />
          <span className="truncate text-sm font-medium text-white">{displayName}</span>
        </div>
        <div className="relative flex shrink-0 items-center gap-0.5 text-white">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
            aria-label="Chat options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg">
              <Link
                href={messagesHref}
                className="block px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                onClick={() => setMenuOpen(false)}
              >
                Open full chat
              </Link>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenChange?.(false);
                }}
              >
                Close
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-white/15"
            aria-label="Minimize chat"
            onClick={() => {
              setMenuOpen(false);
              setMode("minimized");
            }}
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ApplicantConversationClient
          workerId={workerId}
          applicantName={displayName}
          compact
          showHeader={false}
          popupMode
          appliedOnLabel={appliedOnLabel}
        />
      </div>
    </div>
  );
}
