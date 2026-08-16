import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApplicantEmail } from "@/lib/jobs/validation";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const bodySchema = z.object({
  tenant: z.string().min(1),
  applicationId: z.uuid(),
  applicantId: z.uuid(),
  email: z.email(),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, {
    namespace: "job-application-link-profile",
    key: getClientIp(req),
    limit: 30,
    windowMs: 60 * 60 * 1000,
    failClosed: false,
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid applicant details" }, { status: 400 });
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Application service unavailable" }, { status: 503 });

  try {
    const tenant = await resolvePublicTenant(supabase, parsed.data.tenant);
    if (!tenant) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const { data: application, error } = await supabase
      .from("job_applications")
      .select("id, applicant_profile_id, applicant_auth_user_id, status")
      .eq("id", parsed.data.applicationId)
      .eq("tenant_id", tenant.id)
      .eq("applicant_auth_user_id", parsed.data.applicantId)
      .maybeSingle();
    if (error) throw error;
    if (!application?.applicant_profile_id) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const normalizedEmail = normalizeApplicantEmail(parsed.data.email);
    const { data: existing } = await supabase
      .from("applicant_profiles")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("normalized_email", normalizedEmail)
      .neq("id", application.applicant_profile_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          code: "EXISTING_APPLICANT",
          error: "An applicant profile already uses this email. Sign in or recover the existing account to continue.",
          canRecover: true,
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("applicant_profiles")
      .update({
        email: parsed.data.email.trim(),
        normalized_email: normalizedEmail,
        first_name: parsed.data.firstName?.trim() || null,
        last_name: parsed.data.lastName?.trim() || null,
      })
      .eq("id", application.applicant_profile_id)
      .eq("tenant_id", tenant.id);
    if (updateError) throw updateError;
    return NextResponse.json({ linked: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update applicant profile" },
      { status: 500 }
    );
  }
}
