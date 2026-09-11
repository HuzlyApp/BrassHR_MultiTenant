import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireStaffApiSession = vi.fn();
const resolveStaffTenantId = vi.fn();
const createServiceRoleClient = vi.fn();
const writeActivityLog = vi.fn();
const createVerificationNote = vi.fn();
const updateVerificationNote = vi.fn();
const deleteVerificationNote = vi.fn();
const loadVerificationNotesForApplication = vi.fn();
const loadVerificationNoteAuditForApplication = vi.fn();
const requirementHasRecordedVerificationDecision = vi.fn();

vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: (...args: unknown[]) => requireStaffApiSession(...args),
}));

vi.mock("@/lib/jobs/tenant", () => ({
  resolveStaffTenantId: (...args: unknown[]) => resolveStaffTenantId(...args),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClient(...args),
}));

vi.mock("@/lib/audit/activity-log", () => ({
  writeActivityLog: (...args: unknown[]) => writeActivityLog(...args),
}));

vi.mock("@/lib/jobs/match-analysis/verification-notes-service", () => ({
  createVerificationNote: (...args: unknown[]) => createVerificationNote(...args),
  updateVerificationNote: (...args: unknown[]) => updateVerificationNote(...args),
  deleteVerificationNote: (...args: unknown[]) => deleteVerificationNote(...args),
  loadVerificationNotesForApplication: (...args: unknown[]) =>
    loadVerificationNotesForApplication(...args),
  loadVerificationNoteAuditForApplication: (...args: unknown[]) =>
    loadVerificationNoteAuditForApplication(...args),
  requirementHasRecordedVerificationDecision: (...args: unknown[]) =>
    requirementHasRecordedVerificationDecision(...args),
}));

const auth = {
  userId: "recruiter-1",
  email: "recruiter@example.com",
  role: "recruiter",
  godAdmin: false,
  devBypass: false,
  authUser: { id: "recruiter-1", app_metadata: { tenant_id: "tenant-1" } },
};

const sampleNote = {
  id: "note-1",
  requirementId: "req-1",
  jobApplicationId: "app-1",
  workerId: "worker-1",
  jobRequisitionId: "job-1",
  analysisVersion: 1,
  noteBody: "Need TypeScript confirmation",
  candidateQuestion: "Confirm TS experience?",
  dueDate: null,
  verificationStatus: "pending",
  candidateResponse: null,
  candidateRespondedAt: null,
  createdBy: "recruiter-1",
  updatedBy: "recruiter-1",
  createdByName: "Recruiter",
  updatedByName: "Recruiter",
  createdAt: "2026-09-07T10:00:00.000Z",
  updatedAt: "2026-09-07T10:00:00.000Z",
};

describe("requirement verification notes API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireStaffApiSession.mockResolvedValue(auth);
    resolveStaffTenantId.mockResolvedValue("tenant-1");
    createServiceRoleClient.mockReturnValue({ from: vi.fn() });
    writeActivityLog.mockResolvedValue(undefined);
  });

  it("lists notes and audit trail for a requirement", async () => {
    loadVerificationNotesForApplication.mockResolvedValue([sampleNote]);
    loadVerificationNoteAuditForApplication.mockResolvedValue([
      {
        id: "audit-1",
        noteId: "note-1",
        requirementId: "req-1",
        jobApplicationId: "app-1",
        action: "created",
        actorUserId: "recruiter-1",
        actorName: "Recruiter",
        beforeState: null,
        afterState: { note_body: sampleNote.noteBody },
        createdAt: sampleNote.createdAt,
      },
    ]);

    const { GET } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/notes/route"
    );
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/job-applications/app-1/match-analysis/requirements/req-1/notes?includeAudit=1"
      ),
      { params: Promise.resolve({ id: "app-1", requirementId: "req-1" }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.notes).toHaveLength(1);
    expect(body.audit[0].action).toBe("created");
    expect(loadVerificationNotesForApplication).toHaveBeenCalledWith(
      expect.anything(),
      "tenant-1",
      "app-1",
      "req-1"
    );
  });

  it("creates a note without auto-confirming the requirement", async () => {
    createVerificationNote.mockResolvedValue(sampleNote);
    const { POST } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/notes/route"
    );
    const response = await POST(
      new NextRequest("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          noteBody: sampleNote.noteBody,
        }),
      }),
      { params: Promise.resolve({ id: "app-1", requirementId: "req-1" }) }
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.note.id).toBe("note-1");
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "job_application.requirement_verification_note_added",
      })
    );
  });

  it("rejects invalid create payloads", async () => {
    const { POST } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/notes/route"
    );
    const response = await POST(
      new NextRequest("http://localhost", {
        method: "POST",
        body: JSON.stringify({ noteBody: "" }),
      }),
      { params: Promise.resolve({ id: "app-1", requirementId: "req-1" }) }
    );
    expect(response.status).toBe(400);
    expect(createVerificationNote).not.toHaveBeenCalled();
  });

  it("updates and soft-deletes notes with audit activity", async () => {
    updateVerificationNote.mockResolvedValue({
      ...sampleNote,
      verificationStatus: "verified",
      candidateResponse: "Confirmed",
    });
    deleteVerificationNote.mockResolvedValue(undefined);

    const { PATCH, DELETE } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/notes/[noteId]/route"
    );

    const updateRes = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          noteBody: "Confirmed TypeScript experience on two projects.",
        }),
      }),
      {
        params: Promise.resolve({
          id: "app-1",
          requirementId: "req-1",
          noteId: "note-1",
        }),
      }
    );
    expect(updateRes.status).toBe(200);

    const deleteRes = await DELETE(
      new NextRequest("http://localhost", { method: "DELETE" }),
      {
        params: Promise.resolve({
          id: "app-1",
          requirementId: "req-1",
          noteId: "note-1",
        }),
      }
    );
    expect(deleteRes.status).toBe(200);
    expect(writeActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "job_application.requirement_verification_note_deleted",
      })
    );
  });

  it("blocks Confirmed until a verification decision note exists", async () => {
    requirementHasRecordedVerificationDecision.mockResolvedValue(false);
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "req-1", job_application_id: "app-1", recruiter_verified: false },
                error: null,
              }),
            })),
          })),
        })),
      })),
      update: vi.fn(),
    }));
    createServiceRoleClient.mockReturnValue({ from });

    const { PATCH } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/route"
    );
    const response = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ recruiterVerified: true }),
      }),
      { params: Promise.resolve({ id: "app-1", requirementId: "req-1" }) }
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VERIFICATION_DECISION_REQUIRED");
  });

  it("allows Confirmed after a verification decision is recorded", async () => {
    requirementHasRecordedVerificationDecision.mockResolvedValue(true);
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "req-1", job_application_id: "app-1", recruiter_verified: false },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "req-1",
        requirement_text: "TypeScript",
        requirement_type: "MANDATORY",
        status: "PARTIAL",
        requirement_outcome: "VERIFY",
        candidate_evidence: "none",
        verification_required: true,
        confidence: 40,
        recruiter_verified: true,
        recruiter_note: null,
        recruiter_verified_at: "2026-09-07T12:00:00.000Z",
      },
      error: null,
    });
    const updateChain: {
      eq: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
      single: typeof single;
    } = {
      eq: vi.fn(),
      select: vi.fn(),
      single,
    };
    updateChain.eq.mockReturnValue(updateChain);
    updateChain.select.mockReturnValue(updateChain);

    const selectChain: {
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: typeof maybeSingle;
    } = {
      eq: vi.fn(),
      maybeSingle,
    };
    selectChain.eq.mockReturnValue(selectChain);

    const from = vi.fn((table: string) => {
      if (table === "job_application_match_requirements") {
        return {
          select: vi.fn(() => selectChain),
          update: vi.fn(() => updateChain),
        };
      }
      return {};
    });
    createServiceRoleClient.mockReturnValue({ from });

    const { PATCH } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/route"
    );
    const response = await PATCH(
      new NextRequest("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ recruiterVerified: true }),
      }),
      { params: Promise.resolve({ id: "app-1", requirementId: "req-1" }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.requirement.recruiter_verified).toBe(true);
  });

  it("rejects unauthenticated callers", async () => {
    requireStaffApiSession.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const { GET } = await import(
      "@/app/api/admin/job-applications/[id]/match-analysis/requirements/[requirementId]/notes/route"
    );
    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/job-applications/app-1/match-analysis/requirements/req-1/notes"
      ),
      { params: Promise.resolve({ id: "app-1", requirementId: "req-1" }) }
    );
    expect(response.status).toBe(401);
  });
});
