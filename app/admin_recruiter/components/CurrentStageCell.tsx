"use client";

import { useEffect, useId, useState } from "react";

const NOTE_PREVIEW_CHARS = 40;

type CurrentStageCellProps = {
  label: string;
  note?: string | null;
  progress: number;
  barColor: string;
};

function truncateNote(note: string, maxChars: number): { preview: string; truncated: boolean } {
  const trimmed = note.trim();
  if (trimmed.length <= maxChars) {
    return { preview: trimmed, truncated: false };
  }
  return {
    preview: `${trimmed.slice(0, maxChars).trimEnd()}...`,
    truncated: true,
  };
}

function CurrentStageNoteModal({
  open,
  stageLabel,
  note,
  onClose,
}: {
  open: boolean;
  stageLabel: string;
  note: string;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(80vh,560px)] w-full max-w-lg flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-[#0F172A]">
          Stage Note
        </h2>
        <p className="mt-1 text-sm font-medium text-[#334155]">{stageLabel}</p>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5">
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#334155]">{note}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#334155]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Current Stage label + truncated note (View Note modal) + progress bar. */
export function CurrentStageCell({ label, note, progress, barColor }: CurrentStageCellProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const trimmed = note?.trim() || "";
  const { preview, truncated } = truncateNote(trimmed, NOTE_PREVIEW_CHARS);

  return (
    <>
      <div className="w-full min-w-0 max-w-[200px] text-left">
        <p className="truncate text-sm font-semibold leading-5 text-[#0F172A]">{label}</p>
        {trimmed ? (
          <div className="mt-0.5 min-w-0">
            <p className="text-xs leading-4 text-[#64748B]">{preview}</p>
            {truncated ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setNoteOpen(true);
                }}
                className="mt-0.5 text-xs font-semibold text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]"
              >
                View Note
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
      <CurrentStageNoteModal
        open={noteOpen}
        stageLabel={label}
        note={trimmed}
        onClose={() => setNoteOpen(false)}
      />
    </>
  );
}
