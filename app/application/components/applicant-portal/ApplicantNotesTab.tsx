"use client";

import { Loader2 } from "lucide-react";
import type { ApplicantNote } from "./types";

type Props = {
  notes: ApplicantNote[];
  loading: boolean;
};

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

export function ApplicantNotesTab({ notes, loading }: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-8 py-12">
        <Loader2 className="h-9 w-9 animate-spin text-[color:var(--brand-primary)]" aria-hidden />
        <span className="sr-only">Loading notes</span>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="mx-8 mt-6 rounded-2xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
        <h2 className="text-[18px] font-semibold text-[#012352]">No notes yet</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[#64748B]">
          Your recruiter has not added any notes for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-8 py-6">
      {notes.map((note) => (
        <article
          key={note.id}
          className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[#012352]">{note.author_name}</p>
            <time className="text-[12px] text-[#64748B]" dateTime={note.created_at}>
              {formatNoteDate(note.created_at)}
            </time>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#334155]">{note.body}</p>
        </article>
      ))}
    </div>
  );
}
