"use client";

import { useMemo, useState } from "react";
import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";
import type { QualificationFilter, QualificationRequirement } from "@/lib/jobs/match-analysis/workspace";
import {
  countQualificationOutcomes,
  filterQualificationRequirements,
  qualificationDisplayStatus,
  recruiterActionLabel,
  requirementNeedsVerificationNotes,
} from "@/lib/jobs/match-analysis/workspace";
import type { VerificationNote, VerificationNoteDraft } from "@/lib/jobs/match-analysis/verification-notes";
import {
  RequirementNotesIndicator,
  RequirementVerificationNotesPanel,
} from "./ai-analysis/RequirementVerificationNotes";

const FILTERS: Array<{ id: QualificationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "mandatory", label: "Mandatory" },
  { id: "preferred", label: "Preferred" },
  { id: "confirmed", label: "Confirmed" },
  { id: "needs_verification", label: "Needs Verification" },
  { id: "not_met", label: "Not Met" },
  { id: "blocking", label: "Blocking" },
];

function statusClass(status: string): string {
  switch (status) {
    case "Confirmed":
      return "bg-[#DCFCE7] text-[#166534]";
    case "Needs Verification":
      return "bg-[#FEF9C3] text-[#854D0E]";
    case "Blocking":
      return "bg-[#FEE2E2] text-[#991B1B]";
    case "Not Met":
      return "bg-[#FFEDD5] text-[#9A3412]";
    default:
      return "bg-[#F1F5F9] text-[#475569]";
  }
}

export function QualificationChecklist(props: {
  applicationId: string;
  requirements: QualificationRequirement[];
  blockingTexts: string[];
  verifyingId: string | null;
  onToggleVerified: (req: QualificationRequirement) => void;
  verificationNotes?: VerificationNote[];
  busyNoteId?: string | null;
  savingNote?: boolean;
  onCreateNote?: (requirementId: string, draft: VerificationNoteDraft) => Promise<boolean>;
  onUpdateNote?: (
    requirementId: string,
    noteId: string,
    draft: VerificationNoteDraft
  ) => Promise<boolean>;
  onDeleteNote?: (requirementId: string, noteId: string) => Promise<boolean>;
  onAskCandidate?: (note: VerificationNote) => void;
}) {
  const [filter, setFilter] = useState<QualificationFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const counts = useMemo(
    () => countQualificationOutcomes(props.requirements, props.blockingTexts),
    [props.requirements, props.blockingTexts]
  );
  const rows = useMemo(
    () => filterQualificationRequirements(props.requirements, filter, props.blockingTexts),
    [props.requirements, filter, props.blockingTexts]
  );

  const filterCount = (id: QualificationFilter): number => {
    switch (id) {
      case "mandatory":
        return counts.mandatory;
      case "preferred":
        return counts.preferred;
      case "confirmed":
        return counts.confirmed;
      case "needs_verification":
        return counts.verify;
      case "not_met":
        return counts.notMet;
      case "blocking":
        return counts.blocking;
      default:
        return counts.total;
    }
  };

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#0F172A]">Qualification checklist</h3>
      <p className="mt-1 text-xs text-[#64748B]">Every requirement with its evidence and submission impact.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              filter === item.id
                ? "bg-[#0F172A] text-white"
                : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
            }`}
          >
            {item.label} ({filterCount(item.id)})
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-[11px] uppercase tracking-wide text-[#64748B]">
              <th className="py-2 pr-3 font-semibold">Requirement</th>
              <th className="py-2 pr-3 font-semibold">Type</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 font-semibold">Recruiter action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((req) => {
              const display = qualificationDisplayStatus(req, props.blockingTexts);
              const open = openId === req.id;
              const needsNotes = requirementNeedsVerificationNotes(req, props.blockingTexts);
              return (
                <tr key={req.id} className="border-b border-[#F1F5F9] align-top">
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : req.id)}
                        className="text-left font-medium text-[#0F172A]"
                      >
                        {req.requirement_text}
                      </button>
                      <RequirementNotesIndicator requirement={req} />
                    </div>
                    {open && req.candidate_evidence ? (
                      <p className="mt-1 text-xs text-[#64748B]">Evidence: {req.candidate_evidence}</p>
                    ) : null}
                    {open && req.impact ? (
                      <p className="mt-1 text-xs text-[#64748B]">Impact: {req.impact}</p>
                    ) : null}
                    {open ? (
                      <RequirementVerificationNotesPanel
                        applicationId={props.applicationId}
                        requirement={req}
                        notes={(props.verificationNotes ?? []).filter(
                          (note) => note.requirementId === req.id
                        )}
                        busyNoteId={props.busyNoteId ?? null}
                        saving={Boolean(props.savingNote)}
                        onCreate={async (draft) =>
                          props.onCreateNote ? props.onCreateNote(req.id, draft) : false
                        }
                        onUpdate={async (noteId, draft) =>
                          props.onUpdateNote
                            ? props.onUpdateNote(req.id, noteId, draft)
                            : false
                        }
                        onDelete={async (noteId) =>
                          props.onDeleteNote ? props.onDeleteNote(req.id, noteId) : false
                        }
                        onAskCandidate={(note) => props.onAskCandidate?.(note)}
                      />
                    ) : needsNotes || (req.verification_note_count ?? 0) > 0 ? (
                      <RequirementVerificationNotesPanel
                        applicationId={props.applicationId}
                        requirement={req}
                        notes={(props.verificationNotes ?? []).filter(
                          (note) => note.requirementId === req.id
                        )}
                        busyNoteId={props.busyNoteId ?? null}
                        saving={Boolean(props.savingNote)}
                        collapsedSummaryOnly
                        onCreate={async (draft) =>
                          props.onCreateNote ? props.onCreateNote(req.id, draft) : false
                        }
                        onUpdate={async (noteId, draft) =>
                          props.onUpdateNote
                            ? props.onUpdateNote(req.id, noteId, draft)
                            : false
                        }
                        onDelete={async (noteId) =>
                          props.onDeleteNote ? props.onDeleteNote(req.id, noteId) : false
                        }
                        onAskCandidate={(note) => props.onAskCandidate?.(note)}
                      />
                    ) : null}
                    <label
                      htmlFor={`recruiter-verified-${req.id}`}
                      className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#475569]"
                      title={
                        req.recruiter_verified || req.has_verification_decision
                          ? undefined
                          : "Record Verified or Rejected on a note before confirming"
                      }
                    >
                      <ListTableCheckbox
                        id={`recruiter-verified-${req.id}`}
                        size="md"
                        checked={req.recruiter_verified}
                        disabled={
                          props.verifyingId === req.id ||
                          (!req.recruiter_verified && !req.has_verification_decision)
                        }
                        onChange={() => props.onToggleVerified(req)}
                        aria-label={`Recruiter verified: ${req.requirement_text}`}
                      />
                      Recruiter verified
                    </label>
                  </td>
                  <td className="py-2.5 pr-3 text-xs uppercase text-[#64748B]">{req.requirement_type}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${statusClass(display)}`}>
                      {display}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-[#475569]">
                    <div className="flex flex-col gap-1">
                      <span>{recruiterActionLabel(req)}</span>
                      {needsNotes ? (
                        <button
                          type="button"
                          className="w-fit text-left font-semibold text-[color:var(--brand-primary)] hover:underline"
                          onClick={() => setOpenId(req.id)}
                        >
                          Add Note
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="py-4 text-sm text-[#64748B]">
                  No requirements match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
