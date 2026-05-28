import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkerContact = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export async function resolveWorkerContact(
  supabase: SupabaseClient,
  workerId: string
): Promise<WorkerContact | null> {
  const { data, error } = await supabase
    .from("worker")
    .select("id, tenant_id, first_name, last_name, email, phone, user_id")
    .eq("id", workerId)
    .maybeSingle();

  if (error || !data?.id) return null;

  const row = data as Record<string, unknown>;
  let email = row.email != null ? String(row.email).trim() : "";
  let phone = row.phone != null ? String(row.phone).trim() : "";

  const userId = row.user_id != null ? String(row.user_id).trim() : "";
  if (userId && (!email || !phone)) {
    const { data: userRow } = await supabase
      .from("users")
      .select("email, phone")
      .eq("id", userId)
      .maybeSingle();
    if (userRow && typeof userRow === "object") {
      const u = userRow as { email?: string | null; phone?: string | null };
      if (!email && u.email?.trim()) email = u.email.trim();
      if (!phone && u.phone?.trim()) phone = u.phone.trim();
    }
  }

  return {
    id: String(row.id),
    tenantId: row.tenant_id != null ? String(row.tenant_id) : null,
    userId: userId || null,
    firstName: row.first_name != null ? String(row.first_name) : null,
    lastName: row.last_name != null ? String(row.last_name) : null,
    email: email || null,
    phone: phone || null,
  };
}
