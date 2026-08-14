import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type ActivityItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  actor: string | null;
};

function formatUserName(row: { first_name?: string | null; last_name?: string | null; email?: string | null } | undefined) {
  if (!row) return null;
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return name || row.email?.trim() || null;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const { data: application, error } = await supabase
    .from("job_applications")
    .select("id, created_at, created_by_staff_user_id, ai_analyzed_at, ai_analyzed_by, ai_match_score, ai_match_display_category, recruiter_decision, recruiter_decision_at, recruiter_decision_by, job_requisitions(public_title)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const jobTitleRaw = application.job_requisitions as { public_title?: string } | { public_title?: string }[] | null;
  const jobTitle = Array.isArray(jobTitleRaw)
    ? jobTitleRaw[0]?.public_title
    : jobTitleRaw?.public_title;

  const [statusHistory, notes, interviews, analysisVersions, decisions] = await Promise.all([
    supabase
      .from("application_status_history")
      .select("id, from_status_name, to_status_name, note, changed_by_user_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("worker_notes")
      .select("id, body, created_by_user_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("interview_schedules")
      .select("id, title, status, scheduled_date, start_time, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("job_application_analysis_versions")
      .select("id, version, score, display_category, category, analyzed_by, analyzed_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", id)
      .order("version", { ascending: false })
      .limit(20),
    supabase
      .from("job_application_decisions")
      .select("id, decision, recorded_by, recorded_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", id)
      .order("recorded_at", { ascending: false })
      .limit(20),
  ]);

  const userIds = [
    application.created_by_staff_user_id,
    application.ai_analyzed_by,
    application.recruiter_decision_by,
    ...(statusHistory.data ?? []).map((row) => row.changed_by_user_id),
    ...(notes.data ?? []).map((row) => row.created_by_user_id),
    ...(analysisVersions.data ?? []).map((row) => row.analyzed_by),
    ...(decisions.data ?? []).map((row) => row.recorded_by),
  ].filter((value): value is string => Boolean(value));

  const usersById = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .in("id", Array.from(new Set(userIds)));
    for (const user of users ?? []) {
      usersById.set(String(user.id), formatUserName(user) || "Team member");
    }
  }

  const items: ActivityItem[] = [];

  items.push({
    id: `created-${application.id}`,
    at: String(application.created_at),
    title: "Candidate added",
    detail: jobTitle ? `Added to ${jobTitle}` : "Application created",
    actor: application.created_by_staff_user_id
      ? usersById.get(String(application.created_by_staff_user_id)) ?? null
      : null,
  });

  for (const row of statusHistory.data ?? []) {
    items.push({
      id: `status-${row.id}`,
      at: String(row.created_at),
      title: "Status changed",
      detail: row.from_status_name
        ? `${row.from_status_name} → ${row.to_status_name}${row.note ? ` · ${row.note}` : ""}`
        : row.to_status_name,
      actor: row.changed_by_user_id ? usersById.get(String(row.changed_by_user_id)) ?? null : null,
    });
  }

  for (const row of notes.data ?? []) {
    items.push({
      id: `note-${row.id}`,
      at: String(row.created_at),
      title: "Note added",
      detail: String(row.body).slice(0, 180),
      actor: row.created_by_user_id ? usersById.get(String(row.created_by_user_id)) ?? null : null,
    });
  }

  for (const row of interviews.data ?? []) {
    const status = String(row.status);
    items.push({
      id: `interview-${row.id}-${status}`,
      at: String(status === "cancelled" ? row.updated_at : row.created_at),
      title:
        status === "cancelled"
          ? "Interview cancelled"
          : status === "rescheduled"
            ? "Interview rescheduled"
            : "Interview scheduled",
      detail: `${row.title} · ${row.scheduled_date} ${String(row.start_time).slice(0, 5)}`,
      actor: null,
    });
  }

  for (const row of analysisVersions.data ?? []) {
    items.push({
      id: `analysis-${row.id}`,
      at: String(row.analyzed_at),
      title: "Analysis completed",
      detail: `Version ${row.version} · ${row.score ?? "—"}% ${row.display_category || row.category || ""}`.trim(),
      actor: row.analyzed_by ? usersById.get(String(row.analyzed_by)) ?? null : null,
    });
  }

  for (const row of decisions.data ?? []) {
    items.push({
      id: `decision-${row.id}`,
      at: String(row.recorded_at),
      title: "Decision recorded",
      detail: String(row.decision).replace(/_/g, " "),
      actor: row.recorded_by ? usersById.get(String(row.recorded_by)) ?? null : null,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ items });
}
