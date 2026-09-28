import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { stripContactFromPersonName } from "@/lib/resume/normalize-resume-text";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function sanitizePersonNamePart(
  value: string,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  const cleaned = stripContactFromPersonName(value);
  if (!cleaned && label === "First name") {
    return { ok: false, error: "First name is required." };
  }
  if (cleaned && /\d/.test(cleaned)) {
    return { ok: false, error: `${label} cannot include numbers.` };
  }
  if (cleaned && !/^[a-zA-Z\s'.-]+$/.test(cleaned)) {
    return { ok: false, error: `Use letters only in ${label.toLowerCase()}.` };
  }
  return { ok: true, value: cleaned };
}

/** PATCH — rename the candidate behind a job application (profile + worker stay in sync). */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const { id } = await context.params;
    const applicationId = id?.trim();
    if (!applicationId) {
      return NextResponse.json({ error: "Application id is required." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      firstName?: string;
      lastName?: string;
    };
    const firstParsed = sanitizePersonNamePart(String(body.firstName ?? "").trim(), "First name");
    if (!firstParsed.ok) {
      return NextResponse.json({ error: firstParsed.error }, { status: 400 });
    }
    const lastParsed = sanitizePersonNamePart(String(body.lastName ?? "").trim(), "Last name");
    if (!lastParsed.ok) {
      return NextResponse.json({ error: lastParsed.error }, { status: 400 });
    }
    const firstName = firstParsed.value;
    const lastName = lastParsed.value;

    const { data: application, error: appError } = await supabase
      .from("job_applications")
      .select("id, worker_id, applicant_profile_id")
      .eq("tenant_id", tenantId)
      .eq("id", applicationId)
      .maybeSingle();
    if (appError) throw appError;
    if (!application?.id) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const profileId =
      typeof application.applicant_profile_id === "string" &&
      application.applicant_profile_id.trim()
        ? application.applicant_profile_id.trim()
        : null;
    const workerId =
      typeof application.worker_id === "string" && application.worker_id.trim()
        ? application.worker_id.trim()
        : null;

    if (!profileId && !workerId) {
      return NextResponse.json(
        { error: "Candidate profile is not linked yet. Cannot update the name." },
        { status: 400 }
      );
    }

    if (profileId) {
      const { error } = await supabase
        .from("applicant_profiles")
        .update({ first_name: firstName, last_name: lastName || null, updated_at: now })
        .eq("tenant_id", tenantId)
        .eq("id", profileId);
      if (error) throw error;
    }

    if (workerId) {
      const { error } = await supabase
        .from("worker")
        .update({ first_name: firstName, last_name: lastName || null })
        .eq("tenant_id", tenantId)
        .eq("id", workerId);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, firstName, lastName });
  } catch (error) {
    console.error("[admin/job-applications/candidate-name]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the candidate name." },
      { status: 500 }
    );
  }
}
