import type { SupabaseClient } from "@supabase/supabase-js";
import { createSignedPortalFileUrl } from "@/lib/applicant-portal/upload";

export async function resolveWorkerProfilePhotoUrl(
  supabase: SupabaseClient,
  profilePhoto: unknown
): Promise<string | null> {
  const stored = typeof profilePhoto === "string" ? profilePhoto.trim() : "";
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  return createSignedPortalFileUrl(supabase, stored);
}

export async function attachWorkerProfilePhotoUrls<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<Array<T & { profile_photo_url: string | null }>> {
  if (rows.length === 0) return [];

  const needsLookup = rows.some((row) => row.profile_photo === undefined);
  const photoByWorkerId = new Map<string, unknown>();

  if (needsLookup) {
    const workerIds = Array.from(
      new Set(rows.map((row) => (row.id != null ? String(row.id) : "")).filter(Boolean))
    );
    if (workerIds.length > 0) {
      const { data, error } = await supabase
        .from("worker")
        .select("id, profile_photo")
        .in("id", workerIds);
      if (!error) {
        for (const row of data ?? []) {
          const id = row.id != null ? String(row.id) : "";
          if (id) photoByWorkerId.set(id, (row as { profile_photo?: unknown }).profile_photo);
        }
      }
    }
  }

  return Promise.all(
    rows.map(async (row) => {
      const workerId = row.id != null ? String(row.id) : "";
      const storedPhoto =
        row.profile_photo !== undefined ? row.profile_photo : photoByWorkerId.get(workerId);
      return {
        ...row,
        profile_photo_url: await resolveWorkerProfilePhotoUrl(supabase, storedPhoto),
      };
    })
  );
}
