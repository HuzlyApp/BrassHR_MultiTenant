import { NextRequest, NextResponse } from "next/server";
import { formatApiError } from "@/lib/api/format-api-error";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import {
  loadWorkerProfileSkills,
  normalizeWorkerProfileSkillName,
} from "@/lib/worker-profile-skills";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const skills = await loadWorkerProfileSkills(auth.supabase, auth.applicant.id);
    return NextResponse.json({ skills });
  } catch (err) {
    console.error("[applicant-portal/profile-skills GET]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { skillName?: string };
    const skillName = normalizeWorkerProfileSkillName(body.skillName);
    if (!skillName) {
      return NextResponse.json({ error: "Enter a skill name" }, { status: 400 });
    }

    const workerId = auth.applicant.id;
    const tenantId = auth.applicant.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Applicant tenant missing" }, { status: 400 });
    }

    const existing = await loadWorkerProfileSkills(auth.supabase, workerId);
    const duplicate = existing.some(
      (skill) => skill.skill_name.trim().toLowerCase() === skillName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: "This skill is already on your profile." }, { status: 409 });
    }

    const { data, error } = await auth.supabase
      .from("worker_profile_skills")
      .insert({
        worker_id: workerId,
        tenant_id: tenantId,
        skill_name: skillName,
        created_by_user_id: auth.user.id,
      })
      .select("id, skill_name, created_at")
      .single();

    if (error) throw error;

    const skills = await loadWorkerProfileSkills(auth.supabase, workerId);
    return NextResponse.json({ skill: data, skills });
  } catch (err) {
    console.error("[applicant-portal/profile-skills POST]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const skillIdRaw = req.nextUrl.searchParams.get("skillId")?.trim() || "";
    const skillIdCheck = parseRequiredUuid(skillIdRaw, "skillId");
    if (!skillIdCheck.ok) {
      return NextResponse.json({ error: skillIdCheck.error }, { status: 400 });
    }

    const workerId = auth.applicant.id;
    const { error } = await auth.supabase
      .from("worker_profile_skills")
      .delete()
      .eq("id", skillIdCheck.value)
      .eq("worker_id", workerId);

    if (error) throw error;

    const skills = await loadWorkerProfileSkills(auth.supabase, workerId);
    return NextResponse.json({ ok: true, skills });
  } catch (err) {
    console.error("[applicant-portal/profile-skills DELETE]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
