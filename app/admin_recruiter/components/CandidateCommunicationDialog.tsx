"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MessageSquare, X } from "lucide-react";
import toast from "react-hot-toast";

export type CommunicationChannel = "email" | "sms";

type Props = {
  open: boolean;
  onClose: () => void;
  workerId: string;
  candidateName: string;
  email: string | null;
  phone: string | null;
  initialChannel?: CommunicationChannel;
  onSent?: () => void;
};

export default function CandidateCommunicationDialog({
  open,
  onClose,
  workerId,
  candidateName,
  email,
  phone,
  initialChannel = "email",
  onSent,
}: Props) {
  const [channel, setChannel] = useState<CommunicationChannel>(initialChannel);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel(initialChannel);
    setSubject("");
    setBody("");
    setError(null);
  }, [open, initialChannel, workerId]);

  const emailDisabled = !email?.trim();
  const smsDisabled = !phone?.trim();

  useEffect(() => {
    if (channel === "email" && emailDisabled && !smsDisabled) setChannel("sms");
    if (channel === "sms" && smsDisabled && !emailDisabled) setChannel("email");
  }, [channel, emailDisabled, smsDisabled]);

  if (!open) return null;

  async function handleSend() {
    setError(null);
    setSending(true);
    try {
      const url =
        channel === "email"
          ? `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/email`
          : `/api/admin/candidates/${encodeURIComponent(workerId)}/communications/sms`;

      const payload =
        channel === "email"
          ? { subject: subject.trim(), body: body.trim() }
          : { body: body.trim() };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        issues?: Array<{ message: string }>;
      };

      if (!res.ok) {
        const detail =
          json.issues?.map((i) => i.message).join(" ") ||
          json.error ||
          `Send failed (${res.status})`;
        setError(detail);
        return;
      }

      toast.success(channel === "email" ? "Email sent" : "SMS sent");
      onSent?.();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const canSend =
    body.trim().length > 0 &&
    !sending &&
    (channel === "email" ? !emailDisabled && subject.trim().length > 0 : !smsDisabled);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
      onClick={() => !sending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-comm-title"
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="candidate-comm-title" className="text-lg font-semibold text-slate-900">
            Message candidate
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <p className="font-medium text-slate-900">{candidateName}</p>
            <p className="mt-1 text-slate-600">
              Email: {email?.trim() ? email : <span className="text-slate-400">Not on file</span>}
            </p>
            <p className="text-slate-600">
              Phone: {phone?.trim() ? phone : <span className="text-slate-400">Not on file</span>}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={emailDisabled || sending}
              onClick={() => setChannel("email")}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                channel === "email"
                  ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[color:var(--brand-primary)]"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              type="button"
              disabled={smsDisabled || sending}
              onClick={() => setChannel("sms")}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                channel === "sms"
                  ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] text-[color:var(--brand-primary)]"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </button>
          </div>

          {channel === "email" ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending || emailDisabled}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-primary)]"
                placeholder="Subject line"
              />
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending || (channel === "email" ? emailDisabled : smsDisabled)}
              rows={channel === "sms" ? 4 : 8}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-primary)]"
              placeholder={channel === "sms" ? "Text message…" : "Write your message…"}
            />
            {channel === "sms" ? (
              <span className="mt-1 block text-xs text-slate-500">{body.length} / 1600 characters</span>
            ) : null}
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
