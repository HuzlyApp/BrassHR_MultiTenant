"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Message = {
  id: string;
  sender_role: "applicant" | "recruiter";
  body: string;
  created_at: string;
};

export default function ApplicantConversationClient({ workerId }: { workerId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/applicant-portal/messages?workerId=${encodeURIComponent(workerId)}`, {
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as { messages?: Message[]; error?: string };
    if (!res.ok) throw new Error(payload.error || "Could not load messages.");
    setMessages(payload.messages ?? []);
  }, [workerId]);

  useEffect(() => {
    let alive = true;
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

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = body.trim();
    if (!message) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/applicant-portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, body: message }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not send reply.");

      setBody("");
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-6 max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] px-5 py-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">Message Tenant / Recruiter</h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Reply to applicant questions about status, documents, approval timeline, or other concerns.
        </p>
      </div>

      {error ? (
        <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-[260px] flex-col gap-3 px-5 py-4">
        {loading ? <p className="text-sm text-[#64748B]">Loading messages...</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
            No applicant messages yet.
          </p>
        ) : null}
        {messages.map((message) => {
          const isRecruiter = message.sender_role === "recruiter";
          return (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-5 ${
                isRecruiter ? "ml-auto bg-[#0EA5A4] text-white" : "mr-auto bg-[#F1F5F9] text-[#334155]"
              }`}
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">
                {isRecruiter ? "Recruiter" : "Applicant"}
              </p>
              <p>{message.body}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="border-t border-[#E2E8F0] p-5">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a reply to the applicant..."
          rows={3}
          className="w-full resize-none rounded-xl border border-[#CBD5E1] px-4 py-3 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#0EA5A4]"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl bg-[#0EA5A4] px-4 text-sm font-semibold text-white transition hover:bg-[#0C8D8B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </form>
    </section>
  );
}
