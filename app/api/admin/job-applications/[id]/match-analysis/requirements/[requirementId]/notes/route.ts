import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import {
  createVerificationNoteSchema,
} from "@/lib/jobs/match-analysis/verification-notes";
import {
  createVerificationNote,
  loadVerificationNoteAuditForApplication,
  loadVerificationNotesForApplication,
} from "@/lib/jobs/match-analysis/verification-notes-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; requirementId: string }> };

async function authorize(): Promise<
  | {
      auth: Exclude<Awaited<ReturnType<typeof requireStaffApiSession>>, NextResponse>;
      supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>;
      tenantId: string;
    }
  | NextResponse
> {
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
 * List verification notes (and optional audit trail) for one match requirement.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const gate = await authorize();
  if (gate instanceof NextResponse) return gate;
  const { supabase, tenantId } = gate;
  const { id: applicationId, requirementId } = await context.params;
  if (!applicationId?.trim() || !requirementId?.trim()) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const includeAudit =
    new URL(req.url).searchParams.get("includeAudit") === "1";

  try {
    const [notes, audit] = await Promise.all([
      loadVerificationNotesForApplication(supabase, tenantId, applicationId, requirementId),
      includeAudit
        ? loadVerificationNoteAuditForApplication(supabase, tenantId, applicationId, {
            requirementId,
          })
        : Promise.resolve([]),
    ]);
    return NextResponse.json({ notes, audit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load notes" },
      { status: 500 }
    );
  }
}

/**
 * Create or update the single verification note for a requirement. Does not auto-confirm.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const gate = await authorize();
  if (gate instanceof NextResponse) return gate;
  const { auth, supabase, tenantId } = gate;
  const { id: applicationId, requirementId } = await context.params;
  if (!applicationId?.trim() || !requirementId?.trim()) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createVerificationNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const note = await createVerificationNote({
      supabase,
      tenantId,
      applicationId,
      requirementId,
      actorUserId: auth.devBypass ? null : auth.userId,
      input: parsed.data,
    });

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "job_application.requirement_verification_note_added",
      entityType: "job_application",
      entityId: applicationId,
      tenantId,
      request: req,
      metadata: {
        requirementId,
        noteId: note.id,
        verificationStatus: note.verificationStatus,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create note";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
