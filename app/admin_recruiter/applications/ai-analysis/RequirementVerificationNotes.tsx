"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, StickyNote } from "lucide-react";
import {
  VERIFICATION_NOTE_STATUSES,
  VERIFICATION_NOTE_STATUS_LABELS,
  formatVerificationNoteStatus,
  type VerificationNote,
  type VerificationNoteDraft,
  type VerificationNoteStatus,
} from "@/lib/jobs/match-analysis/verification-notes";
import type { QualificationRequirement } from "@/lib/jobs/match-analysis/workspace";
import { requirementNeedsVerificationNotes } from "@/lib/jobs/match-analysis/workspace";

const FIELD =
  "h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[color:var(--brand-primary)]";
const AREA =
  "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[color:var(--brand-primary)]";
const SELECT =
  `${FIELD} appearance-none cursor-pointer bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-10`;
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2398A2B3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export type { VerificationNoteDraft };

const EMPTY_DRAFT: VerificationNoteDraft = {
  noteBody: "",
  candidateQuestion: "",
  dueDate: "",
  verificationStatus: "pending",
  candidateResponse: "",
};

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "verified":
      return "bg-[#DCFCE7] text-[#166534]";
    case "rejected":
      return "bg-[#FEE2E2] text-[#991B1B]";
    case "candidate_responded":
      return "bg-[#DBEAFE] text-[#1E40AF]";
    case "sent_to_candidate":
      return "bg-[#E0E7FF] text-[#3730A3]";
    default:
      return "bg-[#FEF9C3] text-[#854D0E]";
  }
}

export function RequirementNotesIndicator(props: {
  requirement: QualificationRequirement;
  className?: string;
}) {
  const count = props.requirement.verification_note_count ?? 0;
  const pending = props.requirement.has_pending_verification_note;
  if (!count && !pending) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        pending ? "bg-[#FEF9C3] text-[#854D0E]" : "bg-[#EEF2FF] text-[#3730A3]"
      } ${props.className ?? ""}`}
      title={
        pending
          ? `${count} verification note(s); pending follow-up`
          : `${count} verification note(s)`
      }
    >
      <StickyNote className="h-3 w-3" aria-hidden />
      {pending ? "Pending" : `${count}`}
    </span>
  );
}

function NoteFormFields(props: {
  draft: VerificationNoteDraft;
  onChange: (next: VerificationNoteDraft) => void;
  idPrefix: string;
}) {
  const { draft, onChange, idPrefix } = props;
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-body`} className="mb-1 block text-xs font-semibold text-[#475467]">
          Verification note
        </label>
        <textarea
          id={`${idPrefix}-body`}
          value={draft.noteBody}
          onChange={(event) => onChange({ ...draft, noteBody: event.target.value })}
          rows={3}
          className={AREA}
          placeholder="What must be confirmed, what evidence was reviewed, and follow-up needed…"
        />
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-question`}
          className="mb-1 block text-xs font-semibold text-[#475467]"
        >
          Confirmation / question for candidate
        </label>
        <textarea
          id={`${idPrefix}-question`}
          value={draft.candidateQuestion}
          onChange={(event) => onChange({ ...draft, candidateQuestion: event.target.value })}
          rows={2}
          className={AREA}
          placeholder="Ask the candidate to confirm specific experience or evidence…"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-due`} className="mb-1 block text-xs font-semibold text-[#475467]">
            Due date (optional)
          </label>
          <input
            id={`${idPrefix}-due`}
            type="date"
            value={draft.dueDate}
            onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
            className={FIELD}
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-status`}
            className="mb-1 block text-xs font-semibold text-[#475467]"
          >
            Verification status
          </label>
          <select
            id={`${idPrefix}-status`}
            value={draft.verificationStatus}
            onChange={(event) =>
              onChange({
                ...draft,
                verificationStatus: event.target.value as VerificationNoteStatus,
              })
            }
            className={SELECT}
            style={{ backgroundImage: SELECT_CHEVRON }}
          >
            {VERIFICATION_NOTE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {VERIFICATION_NOTE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(draft.verificationStatus === "candidate_responded" ||
        draft.verificationStatus === "verified" ||
        draft.verificationStatus === "rejected" ||
        draft.candidateResponse) && (
        <div>
          <label
            htmlFor={`${idPrefix}-response`}
            className="mb-1 block text-xs font-semibold text-[#475467]"
          >
            Candidate response
          </label>
          <textarea
            id={`${idPrefix}-response`}
            value={draft.candidateResponse}
            onChange={(event) => onChange({ ...draft, candidateResponse: event.target.value })}
            rows={2}
            className={AREA}
            placeholder="Record the candidate’s reply…"
          />
        </div>
      )}
    </div>
  );
}

function NoteCard(props: {
  note: VerificationNote;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAskCandidate: () => void;
  onRecordResponse: () => void;
}) {
  const { note, busy } = props;
  const updated = note.updatedAt !== note.createdAt;
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(note.verificationStatus)}`}
        >
          {formatVerificationNoteStatus(note.verificationStatus)}
        </span>
        <p className="text-[11px] text-[#98A2B3]">
          {updated ? "Updated" : "Added"} by {note.updatedByName ?? note.createdByName} ·{" "}
          {formatWhen(updated ? note.updatedAt : note.createdAt)}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#344054]">{note.noteBody}</p>
      {note.candidateQuestion ? (
        <p className="mt-2 text-xs leading-5 text-[#475467]">
          <span className="font-semibold">Ask candidate:</span> {note.candidateQuestion}
        </p>
      ) : null}
      {note.dueDate ? (
        <p className="mt-1 text-xs text-[#667085]">Due: {note.dueDate}</p>
      ) : null}
      {note.candidateResponse ? (
        <div className="mt-2 rounded-md bg-[#F8FAFC] px-2.5 py-2 text-xs text-[#344054]">
          <span className="font-semibold text-[#475467]">Candidate response:</span>{" "}
          {note.candidateResponse}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {(note.verificationStatus === "pending" ||
          note.verificationStatus === "sent_to_candidate") && (
          <button
            type="button"
            disabled={busy}
            onClick={props.onAskCandidate}
            className="rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Ask Candidate
          </button>
        )}
        {note.verificationStatus !== "verified" && note.verificationStatus !== "rejected" ? (
          <button
            type="button"
            disabled={busy}
            onClick={props.onRecordResponse}
            className="rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Record Response
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={props.onEdit}
          className="rounded-md px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-primary)] hover:underline disabled:opacity-60"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={props.onDelete}
          className="rounded-md px-2.5 py-1 text-xs font-semibold text-[#B42318] hover:underline disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
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
}) {
  const needsVerification = requirementNeedsVerificationNotes(props.requirement);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [draft, setDraft] = useState<VerificationNoteDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);

  const sortedNotes = useMemo(
    () =>
      [...props.notes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [props.notes]
  );
  const latest = sortedNotes[0] ?? props.requirement.latest_verification_note ?? null;
  const older = sortedNotes.slice(1);

  function openCreate(prefill?: Partial<VerificationNoteDraft>) {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, ...prefill });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(note: VerificationNote) {
    setEditingId(note.id);
    setDraft({
      noteBody: note.noteBody,
      candidateQuestion: note.candidateQuestion ?? "",
      dueDate: note.dueDate ?? "",
      verificationStatus: note.verificationStatus,
      candidateResponse: note.candidateResponse ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function submitForm() {
    if (!draft.noteBody.trim()) {
      setFormError("Verification note is required.");
      return;
    }
    setFormError(null);
    const payload: VerificationNoteDraft = {
      ...draft,
      noteBody: draft.noteBody.trim(),
      candidateQuestion: draft.candidateQuestion.trim(),
      dueDate: draft.dueDate.trim(),
      candidateResponse: draft.candidateResponse.trim(),
    };
    const ok = editingId
      ? await props.onUpdate(editingId, payload)
      : await props.onCreate(payload);
    if (ok) {
      setShowForm(false);
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    }
  }

  if (props.collapsedSummaryOnly) {
    if (!latest) return null;
    return (
      <div className="mt-2 rounded-md border border-[#E5E7EB] bg-[#FCFCFD] px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <RequirementNotesIndicator requirement={props.requirement} />
          <span className="text-[11px] font-semibold text-[#667085]">Latest verification note</span>
        </div>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#475467]">{latest.noteBody}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[#E5E7EB] pt-3" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
            Verification notes
          </p>
          <RequirementNotesIndicator requirement={props.requirement} />
        </div>
        <div className="flex flex-wrap gap-2">
          {needsVerification ? (
            <>
              <button
                type="button"
                disabled={props.saving}
                onClick={() =>
                  openCreate({
                    noteBody: props.requirement.candidate_evidence
                      ? `Evidence reviewed: ${props.requirement.candidate_evidence}`
                      : "",
                    candidateQuestion: `Please confirm your experience related to: ${props.requirement.requirement_text}`,
                    verificationStatus: "pending",
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Add Note
              </button>
              <button
                type="button"
                disabled={props.saving}
                onClick={() => {
                  if (latest && "id" in latest && typeof (latest as VerificationNote).id === "string") {
                    props.onAskCandidate(latest as VerificationNote);
                  } else {
                    openCreate({
                      noteBody: `Please confirm: ${props.requirement.requirement_text}`,
                      candidateQuestion: `Can you confirm your hands-on experience with: ${props.requirement.requirement_text}?`,
                      verificationStatus: "sent_to_candidate",
                    });
                  }
                }}
                className="rounded-md bg-[color:var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                Request Confirmation
              </button>
            </>
          ) : null}
        </div>
      </div>

      {latest ? (
        <div className="mt-3 space-y-2">
          {"id" in latest && typeof (latest as VerificationNote).verificationStatus === "string" ? (
            <NoteCard
              note={latest as VerificationNote}
              busy={props.busyNoteId === (latest as VerificationNote).id || props.saving}
              onEdit={() => openEdit(latest as VerificationNote)}
              onDelete={() => void props.onDelete((latest as VerificationNote).id)}
              onAskCandidate={() => props.onAskCandidate(latest as VerificationNote)}
              onRecordResponse={() => {
                openEdit({
                  ...(latest as VerificationNote),
                  verificationStatus: "candidate_responded",
                });
              }}
            />
          ) : (
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm text-[#344054]">
              <p>{latest.noteBody}</p>
              <p className="mt-1 text-[11px] text-[#98A2B3]">
                {latest.createdByName} · {formatWhen(latest.updatedAt || latest.createdAt)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#667085]">
          {needsVerification
            ? "No verification notes yet. Add a note explaining what must be confirmed."
            : "No verification notes for this requirement."}
        </p>
      )}

      {older.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs font-semibold text-[color:var(--brand-primary)] hover:underline"
            onClick={() => setShowHistory((value) => !value)}
          >
            {showHistory ? "Hide note history" : `Show note history (${older.length})`}
          </button>
          {showHistory ? (
            <div className="mt-2 space-y-2">
              {older.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  busy={props.busyNoteId === note.id || props.saving}
                  onEdit={() => openEdit(note)}
                  onDelete={() => void props.onDelete(note.id)}
                  onAskCandidate={() => props.onAskCandidate(note)}
                  onRecordResponse={() =>
                    openEdit({ ...note, verificationStatus: "candidate_responded" })
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <div className="mt-3 rounded-lg border border-[#D0D5DD] bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
            {editingId ? "Edit verification note" : "Add verification note"}
          </p>
          <div className="mt-3">
            <NoteFormFields
              draft={draft}
              onChange={setDraft}
              idPrefix={`req-note-${props.requirement.id}-${editingId ?? "new"}`}
            />
          </div>
          {formError ? <p className="mt-2 text-xs text-[#B42318]">{formError}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={props.saving}
              onClick={() => void submitForm()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {props.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {editingId ? "Save changes" : "Save note"}
            </button>
            <button
              type="button"
              disabled={props.saving}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
                setFormError(null);
              }}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-[#475467] hover:bg-[#F2F4F7]"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#98A2B3]">
            Saving a note does not mark this requirement Confirmed. Set status to Verified or Rejected,
            then use Recruiter verified.
          </p>
        </div>
      ) : null}
    </div>
  );
}
