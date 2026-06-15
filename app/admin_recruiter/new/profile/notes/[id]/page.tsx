"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import DetailedCandidateHeader from "../../../../components/DetailedCandidateHeader";
import DetailedTabs from "../../../../components/DetailedTabs";
import CandidateDetailLoader from "../../../../components/CandidateDetailLoader";
import ProfileSubTabs from "../../../../components/ProfileSubTabs";
import { useCandidateHeader } from "../../../../hooks/useCandidateHeader";

type WorkerNote = {
  id: string;
  body: string;
  created_at: string;
  updated_at?: string;
  author_name: string;
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

export default function NewApplicantProfileNotesPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [showNotePopup, setShowNotePopup] = useState(false);
  const [notes, setNotes] = useState<WorkerNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { name: candidateName, role: candidateRole, status: candidateStatus, loading: headerLoading } = useCandidateHeader(id);
  const pageLoading = headerLoading || notesLoading;

  const loadNotes = useCallback(async () => {
    if (!id) {
      setNotes([]);
      setNotesLoading(false);
      return;
    }

    setNotesLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/worker-notes?workerId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { notes?: WorkerNote[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load notes");
      setNotes(json.notes ?? []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load notes");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const candidateInitials = useMemo(() => initials(candidateName), [candidateName]);

  async function handleSaveNote() {
    if (!id) return;
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
        body: JSON.stringify({ workerId: id, body }),
      });
      const json = (await res.json()) as { note?: WorkerNote; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save note");

      if (json.note) {
        setNotes((current) => [json.note!, ...current]);
      } else {
        await loadNotes();
      }

      setNoteText("");
      setShowNotePopup(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-[1320px] mx-auto">
        <DetailedTabs applicantId={id} activeTab="Profile" />

        {actionError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionError}
          </div>
        ) : null}

        {pageLoading ? (
          <CandidateDetailLoader label="Loading notes..." />
        ) : (
          <>
            <DetailedCandidateHeader name={candidateName} role={candidateRole} status={candidateStatus} />
            <ProfileSubTabs applicantId={id} activeTab="Notes" />

            <div className="relative mx-auto min-h-[520px] w-full max-w-[1300px] rounded-md border border-[#E5E7EB] bg-white p-5">
              {notes.length === 0 ? (
                <div className="flex min-h-[480px] flex-col items-center justify-center gap-[30px] text-center">
                  <div className="flex flex-col items-center gap-3">
                    <h2 className="text-[18px] font-semibold leading-7 text-[#111827]">
                      You have not created any notes yet
                    </h2>
                    <p className="max-w-[560px] text-center text-[14px] font-normal leading-5 text-[#6B7280]">
                      All notes will be displayed on this page once the first note has been noted.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNotePopup(true)}
                    className="inline-flex h-10 w-[124px] items-center justify-center gap-2 rounded-[8px] bg-[color:var(--brand-primary)] px-4 py-[10px] text-sm font-semibold text-white hover:brightness-95"
                  >
                    <span className="text-[20px] leading-none" aria-hidden="true">
                      +
                    </span>
                    <span>Add Note</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
                    <h2 className="text-[20px] font-semibold leading-7 text-[#111827]">Notes</h2>
                    <button
                      type="button"
                      onClick={() => setShowNotePopup(true)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white hover:brightness-95"
                    >
                      <span className="text-[20px] leading-none" aria-hidden="true">
                        +
                      </span>
                      <span>Add Note</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {notes.map((note) => (
                      <article
                        key={note.id}
                        className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#111827]">{note.author_name}</p>
                          <time className="text-xs text-[#6B7280]" dateTime={note.created_at}>
                            {formatNoteDate(note.created_at)}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-[#374151]">{note.body}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {showNotePopup ? (
                <div className="absolute bottom-0 right-0 z-20 w-full max-w-[560px] rounded-t-lg border border-zinc-200 bg-white shadow-xl">
                  <div
                    className="flex h-10 items-center justify-between rounded-t-lg px-3"
                    style={{ background: "var(--brand-primary)" }}
                  >
                    <div className="text-sm font-medium text-white">New Note</div>
                    <div className="flex items-center gap-2 text-white">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotePopup(false);
                          setNoteText("");
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-white/15"
                        aria-label="Close note"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNotePopup(false)}
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
                      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1 text-[#374151]">
                        {[
                          { icon: Bold, label: "Bold" },
                          { icon: Underline, label: "Underline" },
                          { icon: Italic, label: "Italic" },
                          { icon: Strikethrough, label: "Strike" },
                          { icon: List, label: "List" },
                          { icon: ListOrdered, label: "Numbered list" },
                          { icon: AlignLeft, label: "Align left" },
                          { icon: AlignCenter, label: "Align center" },
                          { icon: AlignRight, label: "Align right" },
                          { icon: AlignJustify, label: "Justify" },
                          { icon: Undo2, label: "Undo" },
                          { icon: Redo2, label: "Redo" },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-[#111827] hover:bg-zinc-100"
                            aria-label={item.label}
                          >
                            <item.icon className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
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
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
