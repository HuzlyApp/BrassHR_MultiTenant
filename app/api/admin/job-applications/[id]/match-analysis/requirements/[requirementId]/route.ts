import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { requirementHasRecordedVerificationDecision } from "@/lib/jobs/match-analysis/verification-notes-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { z } from "zod";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; requirementId: string }> };

const patchSchema = z.object({
  recruiterVerified: z.boolean().optional(),
  recruiterNote: z.string().max(4000).nullable().optional(),
});

/**
 * Recruiter verification for a single match requirement (separate from AI output).
 * Confirming requires a recorded verification decision (Verified or Rejected note).
 * Adding a note alone never auto-confirms.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
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

  const { id: applicationId, requirementId } = await context.params;
  if (!applicationId?.trim() || !requirementId?.trim()) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("job_application_match_requirements")
    .select("id, job_application_id, recruiter_verified")
    .eq("id", requirementId)
    .eq("job_application_id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  }

  if (parsed.data.recruiterVerified === true && !existing.recruiter_verified) {
    try {
      const hasDecision = await requirementHasRecordedVerificationDecision(
        supabase,
        tenantId,
        applicationId,
        requirementId
      );
      if (!hasDecision) {
        return NextResponse.json(
          {
            error:
              "Record a verification decision (Verified or Rejected) on a note before marking this requirement Confirmed.",
            code: "VERIFICATION_DECISION_REQUIRED",
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to check verification notes" },
        { status: 500 }
      );
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.recruiterVerified !== undefined) {
    patch.recruiter_verified = parsed.data.recruiterVerified;
    if (parsed.data.recruiterVerified) {
      patch.recruiter_verified_at = new Date().toISOString();
      patch.recruiter_verified_by = auth.userId;
    } else {
      patch.recruiter_verified_at = null;
      patch.recruiter_verified_by = null;
    }
  }

  if (parsed.data.recruiterNote !== undefined) {
    patch.recruiter_note = parsed.data.recruiterNote;
  }

  const { data: updated, error } = await supabase
    .from("job_application_match_requirements")
    .update(patch)
    .eq("id", requirementId)
    .eq("tenant_id", tenantId)
    .select(
      "id, requirement_text, requirement_type, status, requirement_outcome, candidate_evidence, verification_required, confidence, recruiter_verified, recruiter_note, recruiter_verified_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requirement: updated });
}
