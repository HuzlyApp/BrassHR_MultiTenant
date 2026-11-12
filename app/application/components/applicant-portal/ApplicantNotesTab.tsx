"use client";

import type { ApplicantNote } from "./types";
import { WORKER_PORTAL_PAGE_PAD_CLASS } from "./worker-schedule-typography";

type Props = {
  notes: ApplicantNote[];
  loading: boolean;
};

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { timeZone: "America/New_York", 
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function splitAnnouncement(body: string): { title: string | null; content: string } {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { title: lines[0], content: lines.slice(1).join("\n") };
  }
  return { title: null, content: body };
}

export function ApplicantNotesTab({ notes, loading }: Props) {
  if (loading) {
    return null;
  }

  if (notes.length === 0) {
    return (
      <div className={`mx-3 mt-6 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-12 text-center sm:mx-4 min-[1000px]:mx-8`}>
        <h2 className="text-[18px] font-semibold text-[#012352]">No announcements yet</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[#64748B]">
          Your manager, HR, or admin has not posted any announcements yet.
        </p>
      </div>
    );
  }

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} space-y-4`}>
      {notes.map((note) => {
        const { title, content } = splitAnnouncement(note.body);
        return (
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
            {title ? (
              <>
                <h3 className="text-[15px] font-semibold leading-6 text-[#012352]">{title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-[#334155]">{content}</p>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#334155]">{content}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
