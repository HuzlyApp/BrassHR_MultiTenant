import { describe, expect, it } from "vitest";
import {
  canConfirmRequirement,
  createVerificationNoteSchema,
  formatVerificationNoteStatus,
  isVerificationNoteStatus,
  mapVerificationNoteAuditRow,
  mapVerificationNoteRow,
  noteHasVerificationDecision,
  summarizeRequirementNotes,
  updateVerificationNoteSchema,
  verificationNoteSnapshot,
  type VerificationNote,
} from "./verification-notes";
import {
  qualificationDisplayStatus,
  recruiterActionLabel,
  recruiterVerifiedNeedsNoteDecision,
  requirementNeedsVerificationNotes,
  requirementShowsAddNote,
  type QualificationRequirement,
} from "./workspace";

function note(overrides: Partial<VerificationNote> = {}): VerificationNote {
  return {
    id: "note-1",
    requirementId: "req-1",
    jobApplicationId: "app-1",
    workerId: "worker-1",
    jobRequisitionId: "job-1",
    analysisVersion: 2,
    noteBody:
      "Candidate provided Java and Selenium experience, but no TypeScript evidence was found in the résumé. Please confirm the candidate’s hands-on TypeScript experience and the projects where it was used.",
    candidateQuestion: "Please confirm your hands-on TypeScript experience.",
    dueDate: "2026-09-15",
    verificationStatus: "pending",
    candidateResponse: null,
    candidateRespondedAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdByName: "Alex Recruiter",
    updatedByName: "Alex Recruiter",
    createdAt: "2026-09-07T10:00:00.000Z",
    updatedAt: "2026-09-07T10:00:00.000Z",
    ...overrides,
  };
}

function req(overrides: Partial<QualificationRequirement> = {}): QualificationRequirement {
  return {
    id: "req-1",
    requirement_text: "TypeScript experience",
    requirement_type: "MANDATORY",
    status: "NOT_FOUND",
    requirement_outcome: "VERIFY",
    candidate_evidence: "Java and Selenium listed; no TypeScript.",
    verification_required: true,
    confidence: 40,
    recruiter_verified: false,
    recruiter_note: null,
    verification_note_count: 0,
    has_pending_verification_note: false,
    has_verification_decision: false,
    latest_verification_note: null,
    ...overrides,
  };
}

describe("verification notes helpers", () => {
  it("validates create payloads and rejects empty note bodies", () => {
    expect(
      createVerificationNoteSchema.safeParse({
        noteBody: "Needs confirmation of TypeScript projects.",
        candidateQuestion: "Which projects used TypeScript?",
        dueDate: "2026-09-20",
        verificationStatus: "pending",
      }).success
    ).toBe(true);
    expect(createVerificationNoteSchema.safeParse({ noteBody: "   " }).success).toBe(false);
    expect(
      createVerificationNoteSchema.safeParse({
        noteBody: "ok",
        dueDate: "09/20/2026",
      }).success
    ).toBe(false);
  });

  it("requires at least one field on update", () => {
    expect(updateVerificationNoteSchema.safeParse({}).success).toBe(false);
    expect(
      updateVerificationNoteSchema.safeParse({
        verificationStatus: "verified",
        candidateResponse: "Confirmed two React + TypeScript apps.",
      }).success
    ).toBe(true);
  });

  it("maps statuses and decision gates", () => {
    expect(isVerificationNoteStatus("sent_to_candidate")).toBe(true);
    expect(formatVerificationNoteStatus("candidate_responded")).toBe("Candidate Responded");
    expect(noteHasVerificationDecision(note({ verificationStatus: "pending" }))).toBe(false);
    expect(noteHasVerificationDecision(note({ verificationStatus: "verified" }))).toBe(true);
    expect(canConfirmRequirement([note({ verificationStatus: "pending" })])).toBe(false);
    expect(canConfirmRequirement([note({ verificationStatus: "rejected" })])).toBe(true);
  });

  it("summarizes latest note, pending indicators, and decisions per requirement", () => {
    const summaries = summarizeRequirementNotes([
      note({
        id: "older",
        updatedAt: "2026-09-07T09:00:00.000Z",
        verificationStatus: "pending",
      }),
      note({
        id: "newer",
        updatedAt: "2026-09-07T12:00:00.000Z",
        verificationStatus: "sent_to_candidate",
        noteBody: "Follow-up sent to candidate.",
      }),
      note({
        id: "other-req",
        requirementId: "req-2",
        verificationStatus: "verified",
        updatedAt: "2026-09-07T11:00:00.000Z",
      }),
    ]);

    expect(summaries.get("req-1")?.noteCount).toBe(2);
    expect(summaries.get("req-1")?.latestNote?.id).toBe("newer");
    expect(summaries.get("req-1")?.hasPending).toBe(true);
    expect(summaries.get("req-1")?.hasDecision).toBe(false);
    expect(summaries.get("req-2")?.hasDecision).toBe(true);
    expect(summaries.get("req-2")?.hasPending).toBe(false);
  });

  it("maps db rows and audit events with author names", () => {
    const users = new Map([["user-1", { name: "Alex Recruiter" }]]);
    const mapped = mapVerificationNoteRow(
      {
        id: "n1",
        requirement_id: "req-1",
        job_application_id: "app-1",
        worker_id: "worker-1",
        job_requisition_id: "job-1",
        analysis_version: 3,
        note_body: "Need TypeScript confirmation",
        candidate_question: "Confirm TS?",
        due_date: "2026-09-10",
        verification_status: "pending",
        candidate_response: null,
        candidate_responded_at: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: "2026-09-07T10:00:00.000Z",
        updated_at: "2026-09-07T10:00:00.000Z",
      },
      users
    );
    expect(mapped.createdByName).toBe("Alex Recruiter");
    expect(mapped.analysisVersion).toBe(3);

    const audit = mapVerificationNoteAuditRow(
      {
        id: "a1",
        note_id: "n1",
        requirement_id: "req-1",
        job_application_id: "app-1",
        action: "created",
        actor_user_id: "user-1",
        before_state: null,
        after_state: verificationNoteSnapshot({
          note_body: "Need TypeScript confirmation",
          verification_status: "pending",
        }),
        created_at: "2026-09-07T10:00:00.000Z",
      },
      users
    );
    expect(audit.action).toBe("created");
    expect(audit.actorName).toBe("Alex Recruiter");
    expect(audit.afterState?.note_body).toBe("Need TypeScript confirmation");
  });

  it("keeps notes scoped summaries from leaking across requirements", () => {
    const summaries = summarizeRequirementNotes([
      note({ id: "a", requirementId: "req-a", jobApplicationId: "app-a" }),
      note({ id: "b", requirementId: "req-b", jobApplicationId: "app-b" }),
    ]);
    expect(summaries.get("req-a")?.latestNote?.jobApplicationId).toBe("app-a");
    expect(summaries.get("req-b")?.latestNote?.id).toBe("b");
    expect(summaries.get("req-a")?.noteCount).toBe(1);
  });
});

describe("qualification checklist + verification note display", () => {
  it("shows Needs Verification and Ask candidate until notes exist", () => {
    const row = req();
    expect(qualificationDisplayStatus(row)).toBe("Needs Verification");
    expect(requirementNeedsVerificationNotes(row)).toBe(true);
    expect(recruiterActionLabel(row)).toBe("Ask candidate");
  });

  it("updates action labels when notes are pending or present", () => {
    expect(
      recruiterActionLabel(
        req({ verification_note_count: 1, has_pending_verification_note: true })
      )
    ).toBe("Follow up");
    expect(
      recruiterActionLabel(
        req({
          verification_note_count: 2,
          has_pending_verification_note: false,
          has_verification_decision: true,
        })
      )
    ).toBe("Review notes");
  });

  it("does not treat Confirmed from notes alone; recruiter_verified still required", () => {
    expect(
      qualificationDisplayStatus(
        req({
          has_verification_decision: true,
          verification_note_count: 1,
          recruiter_verified: false,
        })
      )
    ).toBe("Needs Verification");
    expect(
      qualificationDisplayStatus(
        req({
          has_verification_decision: true,
          recruiter_verified: true,
        })
      )
    ).toBe("Confirmed");
  });

  it("keeps Recruiter verified locked until a Verified or Rejected note exists", () => {
    expect(recruiterVerifiedNeedsNoteDecision(req())).toBe(true);
    expect(recruiterVerifiedNeedsNoteDecision(req({ has_verification_decision: true }))).toBe(false);
    expect(
      recruiterVerifiedNeedsNoteDecision(req({ recruiter_verified: true, has_verification_decision: true }))
    ).toBe(false);
  });

  it("still offers Add Note when confirmation is gated on a MET requirement", () => {
    const met = req({
      requirement_outcome: "MET",
      status: "CONFIRMED",
      verification_required: false,
      recruiter_verified: false,
      has_verification_decision: false,
    });
    expect(requirementNeedsVerificationNotes(met)).toBe(false);
    expect(requirementShowsAddNote(met)).toBe(true);
  });
});
