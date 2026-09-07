import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { updateVerificationNoteSchema } from "@/lib/jobs/match-analysis/verification-notes";
import {
  deleteVerificationNote,
  updateVerificationNote,
} from "@/lib/jobs/match-analysis/verification-notes-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; requirementId: string; noteId: string }>;
};

async function authorize() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }
  return { auth, supabase, tenantId };
}

/**
 * Update a verification note (body, question, due date, status, candidate response).
 * Soft-delete is handled by DELETE. Edits are audited; previous values are preserved.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const gate = await authorize();
  if (gate instanceof NextResponse) return gate;
  const { auth, supabase, tenantId } = gate;
  const { id: applicationId, requirementId, noteId } = await context.params;
  if (!applicationId?.trim() || !requirementId?.trim() || !noteId?.trim()) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateVerificationNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const note = await updateVerificationNote({
      supabase,
      tenantId,
      applicationId,
      requirementId,
      noteId,
      actorUserId: auth.devBypass ? null : auth.userId,
      input: parsed.data,
    });

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "job_application.requirement_verification_note_updated",
      entityType: "job_application",
      entityId: applicationId,
      tenantId,
      request: req,
      metadata: {
        requirementId,
        noteId,
        verificationStatus: note.verificationStatus,
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update note";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Soft-delete a verification note. Audit trail retains prior content.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const gate = await authorize();
  if (gate instanceof NextResponse) return gate;
  const { auth, supabase, tenantId } = gate;
  const { id: applicationId, requirementId, noteId } = await context.params;
  if (!applicationId?.trim() || !requirementId?.trim() || !noteId?.trim()) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  try {
    await deleteVerificationNote({
      supabase,
      tenantId,
      applicationId,
      requirementId,
      noteId,
      actorUserId: auth.devBypass ? null : auth.userId,
    });

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "job_application.requirement_verification_note_deleted",
      entityType: "job_application",
      entityId: applicationId,
      tenantId,
      request: req,
      metadata: { requirementId, noteId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete note";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
