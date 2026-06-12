"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { WorkerNoteDto } from "@/lib/worker-notes";

type Props = {
  title?: string;
  emptyMessage?: string;
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

export default function ApplicantRecruiterNotes({
  title = "Message from recruiter",
  emptyMessage,
}: Props) {
  const [notes, setNotes] = useState<WorkerNoteDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const applicantId =
        typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || "" : "";
      if (!applicantId) {
        if (alive) {
          setNotes([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/onboarding/worker-notes?applicantId=${encodeURIComponent(applicantId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as { notes?: WorkerNoteDto[] };
        if (!alive) return;
        setNotes(json.notes ?? []);
      } catch {
        if (alive) setNotes([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-[color:var(--brand-primary)]" aria-hidden />
        Loading recruiter message...
      </div>
    );
  }

  if (notes.length === 0) {
    return emptyMessage ? (
      <p className="text-[16px] font-normal leading-8 text-slate-700">{emptyMessage}</p>
    ) : null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[18px] font-semibold leading-7 text-slate-900">{title}</h3>
      {notes.map((note) => (
        <article
          key={note.id}
          className="rounded-xl border border-[color:color-mix(in_srgb,var(--brand-primary)_25%,white)] bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] p-4"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-[color:var(--brand-primary)]">
              {note.author_name}
            </p>
            <time className="text-[12px] text-slate-500" dateTime={note.created_at}>
              {formatNoteDate(note.created_at)}
            </time>
          </div>
          <p className="whitespace-pre-wrap text-[16px] leading-8 text-slate-800">{note.body}</p>
        </article>
      ))}
    </div>
  );
}
