"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Minus,
  X,
} from "lucide-react";
import type { WorkerNoteDto } from "@/lib/worker-notes";

type CandidateNotesPanelProps = {
  workerId: string;
  candidateName: string;
  /** Full notes tab page vs compact sidebar on profile details */
  layout?: "page" | "sidebar";
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CandidateNotesPanel({
  workerId,
  candidateName,
  layout = "sidebar",
}: CandidateNotesPanelProps) {
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [notes, setNotes] = useState<WorkerNoteDto[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const candidateInitials = useMemo(() => initials(candidateName), [candidateName]);
  const isPage = layout === "page";

  const loadNotes = useCallback(async () => {
    if (!workerId) {
      setNotes([]);
      setNotesLoading(false);
      return;
    }

    setNotesLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/worker-notes?workerId=${encodeURIComponent(workerId)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { notes?: WorkerNoteDto[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load notes");
      setNotes(json.notes ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load notes");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  function closeModal() {
    setShowNotePopup(false);
    setNoteText("");
  }

  async function handleSaveNote() {
    if (!workerId) return;
    const body = noteText.trim();
    if (!body) {
      setActionError("Please type a note before saving.");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/worker-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, body }),
      });
      const json = (await res.json()) as { note?: WorkerNoteDto; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save note");

      if (json.note) {
        setNotes((current) => [json.note!, ...current]);
      } else {
        await loadNotes();
      }

      closeModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={() => setShowNotePopup(true)}
      className={
        isPage
          ? "inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white hover:brightness-95"
          : "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-4 text-xs font-semibold text-white hover:brightness-95"
      }
    >
      <span className="text-base leading-none" aria-hidden="true">
        +
      </span>
      <span>{isPage ? "Add Note" : "Add"}</span>
    </button>
  );

  const noteModal = showNotePopup ? (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/20"
        aria-label="Close note dialog"
        onClick={closeModal}
      />
      <div
        className={`z-50 w-full max-w-[560px] rounded-t-lg border border-zinc-200 bg-white shadow-xl ${
          isPage ? "absolute bottom-0 right-0" : "fixed bottom-0 right-0 sm:right-6"
        }`}
      >
        <div
          className="flex h-10 items-center justify-between rounded-t-lg px-3"
          style={{ background: "var(--brand-primary)" }}
        >
          <div className="text-sm font-medium text-white">New Note</div>
          <div className="flex items-center gap-2 text-white">
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
              aria-label="Close note"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
              aria-label="Minimize note"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3">
          <div>
            <div className="mb-1 text-xs text-[#6B7280]">Relate to</div>
            <div className="flex h-10 items-center gap-3 rounded border border-[#94A3B8] bg-[#F8FAFC] px-3 text-sm text-[#111827]">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                }}
              >
                {candidateInitials}
              </span>
              <span>{candidateName}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200">
            {/* Toolbar intentionally hidden as requested */}
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Add your notes here"
              className="h-[200px] w-full resize-none p-3 text-sm text-[#111827] placeholder:text-[#94A3B8] outline-none"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={saving || !noteText.trim()}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  ) : null;

  if (isPage) {
    return (
      <div className="relative min-h-[520px] w-full min-w-0 rounded-md border border-[#E5E7EB] bg-white p-5">
        {actionError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionError}
          </div>
        ) : null}

        {notesLoading ? (
          <div className="py-12 text-center text-sm text-[#6B7280]">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center gap-[30px] text-center">
            <div className="flex flex-col items-center gap-3">
              <h2 className="text-[18px] font-semibold leading-7 text-[#111827]">
                You have not created any notes yet
              </h2>
              <p className="max-w-[560px] text-center text-[14px] font-normal leading-5 text-[#6B7280]">
                All notes will be displayed on this page once the first note has been noted.
              </p>
            </div>
            {addButton}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
              <h2 className="text-[20px] font-semibold leading-7 text-[#111827]">Notes</h2>
              {addButton}
            </div>
            <NotesList notes={notes} />
          </div>
        )}

        {noteModal}
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white pr-px">
      <div className="flex h-11 items-center justify-between gap-2 border-b border-[#E5E7EB] px-5">
        <div className="text-[20px] font-semibold leading-7 text-[#111827]">Notes</div>
        {addButton}
      </div>

      <div className="p-5">
        {actionError ? (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {actionError}
          </div>
        ) : null}

        {notesLoading ? (
          <div className="py-4 text-xs text-[#9CA3AF]">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-[#9CA3AF]">No notes yet. Click + Add to write one.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-[#9CA3AF]">
              {notes.length} note{notes.length === 1 ? "" : "s"}
            </div>
            <NotesList notes={notes} compact />
          </div>
        )}
      </div>

      {noteModal}
    </div>
  );
}

function NotesList({ notes, compact = false }: { notes: WorkerNoteDto[]; compact?: boolean }) {
  return (
    <div className={compact ? "max-h-[320px] space-y-2 overflow-y-auto pr-1" : "space-y-3"}>
      {notes.map((note) => (
        <article
          key={note.id}
          className={`rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] ${compact ? "p-3" : "p-4"}`}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className={`font-semibold text-[#111827] ${compact ? "text-xs" : "text-sm"}`}>
              {note.author_name}
            </p>
            <time className="text-xs text-[#6B7280]" dateTime={note.created_at}>
              {formatNoteDate(note.created_at)}
            </time>
          </div>
          <p
            className={`whitespace-pre-wrap leading-6 text-[#374151] ${
              compact ? "text-xs leading-5" : "text-sm"
            }`}
          >
            {note.body}
          </p>
        </article>
      ))}
    </div>
  );
}
