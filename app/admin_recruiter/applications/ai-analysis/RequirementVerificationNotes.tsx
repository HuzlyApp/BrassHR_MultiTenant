"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, StickyNote } from "lucide-react";
import type { VerificationNote, VerificationNoteDraft } from "@/lib/jobs/match-analysis/verification-notes";
import type { QualificationRequirement } from "@/lib/jobs/match-analysis/workspace";
import { requirementNeedsVerificationNotes } from "@/lib/jobs/match-analysis/workspace";

const AREA =
  "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[color:var(--brand-primary)]";

export type { VerificationNoteDraft };

export function RequirementNotesIndicator(props: {
  requirement: QualificationRequirement;
  className?: string;
}) {
  const count = props.requirement.verification_note_count ?? 0;
  if (!count && !props.requirement.latest_verification_note) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3730A3] ${props.className ?? ""}`}
      title="Verification note saved"
    >
      <StickyNote className="h-3 w-3" aria-hidden />
      Note
    </span>
  );
}

export function recruiterVerifiedNotePrefill(
  _requirement?: QualificationRequirement
): Partial<VerificationNoteDraft> {
  return { noteBody: "" };
}

export function pendingVerificationNotePrefill(
  _requirement?: QualificationRequirement
): Partial<VerificationNoteDraft> {
  return { noteBody: "" };
}

export function RequirementVerificationNotesPanel(props: {
  applicationId: string;
  requirement: QualificationRequirement;
  notes: VerificationNote[];
  busyNoteId: string | null;
  saving: boolean;
  onCreate: (draft: VerificationNoteDraft) => Promise<boolean>;
  onUpdate: (noteId: string, draft: VerificationNoteDraft) => Promise<boolean>;
  onDelete: (noteId: string) => Promise<boolean>;
  onAskCandidate: (note: VerificationNote) => void;
  collapsedSummaryOnly?: boolean;
  /** Increment to focus the note field (e.g. after clicking Add Note). */
  openCreateSignal?: number;
  createPrefill?: Partial<VerificationNoteDraft>;
  onOpenCreateConsumed?: () => void;
}) {
  const needsVerification = requirementNeedsVerificationNotes(props.requirement);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const existing = useMemo(() => {
    const sorted = [...props.notes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted[0] ?? null;
  }, [props.notes]);
  const [body, setBody] = useState(existing?.noteBody ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setBody(existing?.noteBody ?? "");
  }, [existing?.id, existing?.noteBody]);

  useEffect(() => {
    if (!props.openCreateSignal) return;
    if (props.createPrefill?.noteBody && !existing) {
      setBody(props.createPrefill.noteBody);
    }
    textareaRef.current?.focus();
    props.onOpenCreateConsumed?.();
    // Prefill is read at signal time so Add Note / Recruiter verified can focus the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.openCreateSignal]);

  async function saveNote() {
    const noteBody = body.trim();
    if (!noteBody) {
      setFormError("Note is required.");
      return;
    }
    setFormError(null);
    const draft: VerificationNoteDraft = { noteBody };
    if (existing) {
      await props.onUpdate(existing.id, draft);
      return;
    }
    await props.onCreate(draft);
  }

  if (props.collapsedSummaryOnly) {
    if (!existing && !props.requirement.latest_verification_note) return null;
    const preview = existing?.noteBody ?? props.requirement.latest_verification_note?.noteBody ?? "";
    if (!preview) return null;
    return (
      <div className="mt-2 rounded-md border border-[#E5E7EB] bg-[#FCFCFD] px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <RequirementNotesIndicator requirement={props.requirement} />
          <span className="text-[11px] font-semibold text-[#667085]">Note</span>
        </div>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#475467]">{preview}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[#E5E7EB] pt-3" onClick={(event) => event.stopPropagation()}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">Note</p>
      <textarea
        ref={textareaRef}
        id={`req-note-${props.requirement.id}`}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (formError) setFormError(null);
        }}
        rows={3}
        className={`${AREA} mt-2`}
        placeholder={
          needsVerification
            ? "Add a note about what must be confirmed…"
            : "Add a note for this requirement…"
        }
      />
      {formError ? <p className="mt-2 text-xs text-[#B42318]">{formError}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={props.saving}
          onClick={() => void saveNote()}
          className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          {props.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save note
        </button>
        {existing ? (
          <>
            <button
              type="button"
              disabled={props.saving || props.busyNoteId === existing.id}
              onClick={() => props.onAskCandidate(existing)}
              className="rounded-md border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-60"
            >
              Ask Candidate
            </button>
            <button
              type="button"
              disabled={props.saving || props.busyNoteId === existing.id}
              onClick={() => void props.onDelete(existing.id)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60"
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
