"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ApplicantConversationClient from "@/app/admin_recruiter/messages/ApplicantConversationClient";
import {
  formatMessageTime,
  upsertConversationFromMessage,
  type StaffConversation,
} from "@/lib/messaging/staff-conversations";
import { useApplicantConversationsRealtime } from "@/lib/messaging/useApplicantConversationsRealtime";

type ConversationsResponse = {
  conversations?: StaffConversation[];
  tenantId?: string | null;
  unreadMessages?: number;
  error?: string;
};

export default function AdminRecruiterMessagesClient({
  initialWorkerId,
}: {
  initialWorkerId?: string | null;
}) {
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialWorkerId ?? null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/admin/messages/conversations", { cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as ConversationsResponse;
    if (!res.ok) throw new Error(payload.error || "Could not load conversations.");
    setConversations(payload.conversations ?? []);
    setTenantId(payload.tenantId ?? null);
    return payload.conversations ?? [];
  }, []);

  const handleRealtimeInsert = useCallback(
    (message: Parameters<typeof upsertConversationFromMessage>[1]) => {
      setConversations((current) => upsertConversationFromMessage(current, message));
      void loadConversations();
    },
    [loadConversations]
  );

  useApplicantConversationsRealtime(tenantId, handleRealtimeInsert, !loading);

  useEffect(() => {
    if (initialWorkerId) {
      setSelectedWorkerId(initialWorkerId);
    }
  }, [initialWorkerId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const items = await loadConversations();
        if (!alive) return;
        setSelectedWorkerId((current) => current ?? items[0]?.workerId ?? null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load conversations.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadConversations]);

  const selectedConversation = conversations.find((item) => item.workerId === selectedWorkerId) ?? null;

  return (
    <main className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#0F172A]">Messages</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Applicant conversations for your tenant. New messages appear in real time.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[#E2E8F0] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#E2E8F0] px-4 py-3">
            <p className="text-sm font-semibold text-[#0F172A]">Conversations</p>
            <p className="text-xs text-[#64748B]">
              {loading ? "Loading..." : `${conversations.length} applicant thread${conversations.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="max-h-[520px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-[#64748B]">Loading conversations...</p>
            ) : null}
            {!loading && conversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#64748B]">
                No applicant messages yet. Approved applicants can message you from their dashboard.
              </p>
            ) : null}
            {conversations.map((conversation) => {
              const active = conversation.workerId === selectedWorkerId;
              return (
                <button
                  key={conversation.workerId}
                  type="button"
                  onClick={() => setSelectedWorkerId(conversation.workerId)}
                  className={`block w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition hover:bg-[#F8FAFC] ${
                    active ? "bg-[#F0FDFA]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">{conversation.applicantName}</p>
                      <p className="mt-1 truncate text-sm text-[#64748B]">{conversation.preview}</p>
                      <p className="mt-1 text-[11px] text-[#94A3B8]">{formatMessageTime(conversation.sentAt)}</p>
                    </div>
                    {conversation.unreadCount > 0 ? (
                      <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#0EA5A4] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-[420px] p-4 lg:p-5">
          {selectedWorkerId && selectedConversation ? (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#0F172A]">{selectedConversation.applicantName}</h2>
                  <p className="text-sm text-[#64748B]">Applicant conversation</p>
                </div>
                <Link
                  href={`/admin_recruiter/messages/${selectedWorkerId}`}
                  className="text-sm font-medium text-[#0EA5A4] hover:underline"
                >
                  Open full page
                </Link>
              </div>
              <ApplicantConversationClient workerId={selectedWorkerId} compact />
            </div>
          ) : (
            <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl bg-[#F8FAFC] px-6 text-center">
              <p className="max-w-sm text-sm text-[#64748B]">
                {loading
                  ? "Loading conversations..."
                  : "Select an applicant conversation to view messages and reply."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
