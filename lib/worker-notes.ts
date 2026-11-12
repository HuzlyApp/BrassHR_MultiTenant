import type { SupabaseClient } from "@supabase/supabase-js";
import { labelForRole, matchStaffRole, SEEDED_STAFF_ROLES } from "@/lib/admin/staff-roles";

export type WorkerNoteDto = {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
};

type NoteRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at?: string;
  created_by_user_id: string | null;
  tenant_id?: string | null;
};

type UserNameRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

/** Roles workers see as announcement sources. */
const ANNOUNCEMENT_AUTHOR_ROLE_KEYS = new Set(["manager", "hr", "admin"]);

function personAuthorName(user: UserNameRow | undefined, fallback = "Recruiter"): string {
  if (!user) return fallback;
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || fallback;
}

function announcementAuthorLabel(role: string | null | undefined, fallback: string): string {
  const matched = matchStaffRole(role, SEEDED_STAFF_ROLES);
  if (matched && ANNOUNCEMENT_AUTHOR_ROLE_KEYS.has(matched.key)) {
    return labelForRole(matched.key, SEEDED_STAFF_ROLES) ?? matched.label;
  }
  return fallback;
}

export async function loadWorkerNotesForWorkerId(
  supabase: SupabaseClient,
  workerId: string,
  options?: {
    authorFallback?: string;
    applicationId?: string | null;
    /** `staff_role` shows Manager / HR / Admin for worker-facing announcements. */
    authorDisplay?: "name" | "staff_role";
  }
): Promise<WorkerNoteDto[]> {
  let query = supabase
    .from("worker_notes")
    .select("id, body, created_at, updated_at, created_by_user_id, tenant_id")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });

  const applicationId = options?.applicationId?.trim();
  if (applicationId) {
    query = query.eq("application_id", applicationId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as NoteRow[];
  const authorIds = [
    ...new Set(rows.map((row) => row.created_by_user_id).filter(Boolean)),
  ] as string[];

  const usersById = new Map<string, UserNameRow>();
  if (authorIds.length > 0 && options?.authorDisplay !== "staff_role") {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .in("id", authorIds);
    if (usersError) throw usersError;
    for (const user of (users ?? []) as UserNameRow[]) {
      usersById.set(user.id, user);
    }
  }

  const roleByUserId = new Map<string, string>();
  if (authorIds.length > 0 && options?.authorDisplay === "staff_role") {
    const tenantIds = [
      ...new Set(rows.map((row) => row.tenant_id).filter(Boolean)),
    ] as string[];
    let rolesQuery = supabase
      .from("user_roles")
      .select("user_id, role, tenant_id")
      .in("user_id", authorIds);
    if (tenantIds.length > 0) {
      rolesQuery = rolesQuery.in("tenant_id", tenantIds);
    }
    const { data: roles, error: rolesError } = await rolesQuery;
    if (rolesError) throw rolesError;
    for (const row of (roles ?? []) as { user_id: string; role: string | null }[]) {
      if (!row.user_id || !row.role) continue;
      if (!roleByUserId.has(row.user_id)) {
        roleByUserId.set(row.user_id, row.role);
      }
    }
  }

  const fallback = options?.authorFallback ?? "Recruiter";
  const useRole = options?.authorDisplay === "staff_role";

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author_name: useRole
      ? announcementAuthorLabel(
          row.created_by_user_id ? roleByUserId.get(row.created_by_user_id) : undefined,
          fallback
        )
      : personAuthorName(
          row.created_by_user_id ? usersById.get(row.created_by_user_id) : undefined,
          fallback
        ),
  }));
}
