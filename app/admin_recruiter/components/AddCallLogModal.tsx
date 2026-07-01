"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";

type CallLogOutcome = "answered" | "no_answer";

type AddCallLogModalProps = {
  open: boolean;
  workerId: string;
  onClose: () => void;
  onAdded?: () => void | Promise<void>;
};

export default function AddCallLogModal({
  open,
  workerId,
  onClose,
  onAdded,
}: AddCallLogModalProps) {
  const [outcome, setOutcome] = useState<CallLogOutcome | "">("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setOutcome("");
      setDurationMinutes("");
      setNotes("");
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!outcome) {
      toast.error("Pick call result");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/worker-call-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          outcome,
          durationMinutes: durationMinutes.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Could not save call log");
      }
      toast.success("Call log saved");
      await onAdded?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save call log";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <h2 className="text-xl font-semibold text-[#1F2937]">Add call log</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"
            aria-label="Close add call log modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 px-6 py-5">
          <div>
            <p className="mb-3 text-sm font-medium text-[#374151]">Call result</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOutcome("answered")}
                className={`min-h-12 rounded-lg border px-3 text-sm font-semibold transition ${
                  outcome === "answered"
                    ? "border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[var(--brand-primary)]"
                    : "border-[#D1D5DB] bg-white text-[#374151] hover:border-[var(--brand-primary)]"
                }`}
              >
                Answered
              </button>
              <button
                type="button"
                onClick={() => setOutcome("no_answer")}
                className={`min-h-12 rounded-lg border px-3 text-sm font-semibold transition ${
                  outcome === "no_answer"
                    ? "border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[var(--brand-primary)]"
                    : "border-[#D1D5DB] bg-white text-[#374151] hover:border-[var(--brand-primary)]"
                }`}
              >
                No answer
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="call-log-duration" className="block text-sm font-medium text-[#374151]">
              Minutes on call
            </label>
            <input
              id="call-log-duration"
              type="number"
              min={0}
              step={1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              placeholder="Optional"
              className="mt-2 w-full rounded-lg border border-[#D1D5DB] px-4 py-3 text-base text-[#111827] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
            />
          </div>

          <div>
            <label htmlFor="call-log-notes" className="block text-sm font-medium text-[#374151]">
              Notes
            </label>
            <textarea
              id="call-log-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional"
              rows={3}
              maxLength={2000}
              className="mt-2 w-full resize-none rounded-lg border border-[#D1D5DB] px-4 py-3 text-base text-[#111827] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] px-4 text-sm font-semibold text-[#374151]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
