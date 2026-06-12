import type { SupabaseClient } from "@supabase/supabase-js";

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
};

type UserNameRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function recruiterAuthorName(user: UserNameRow | undefined, fallback = "Recruiter"): string {
  if (!user) return fallback;
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || fallback;
}

export async function loadWorkerNotesForWorkerId(
  supabase: SupabaseClient,
  workerId: string,
  options?: { authorFallback?: string }
): Promise<WorkerNoteDto[]> {
  const { data, error } = await supabase
    .from("worker_notes")
    .select("id, body, created_at, updated_at, created_by_user_id")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as NoteRow[];
  const authorIds = [
    ...new Set(rows.map((row) => row.created_by_user_id).filter(Boolean)),
  ] as string[];

  const usersById = new Map<string, UserNameRow>();
  if (authorIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .in("id", authorIds);
    if (usersError) throw usersError;
    for (const user of (users ?? []) as UserNameRow[]) {
      usersById.set(user.id, user);
    }
  }

  const fallback = options?.authorFallback ?? "Recruiter";
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author_name: recruiterAuthorName(
      row.created_by_user_id ? usersById.get(row.created_by_user_id) : undefined,
      fallback
    ),
  }));
}
