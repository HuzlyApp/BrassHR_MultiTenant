import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalRole } from "@/lib/auth/app-role";

type AuthAdmin = {
  getUserById: (id: string) => Promise<{ data: { user: { email?: string | null; app_metadata?: Record<string, unknown> } | null }; error: { message: string } | null }>;
  updateUserById: (id: string, attrs: { app_metadata: Record<string, unknown> }) => Promise<{ error: { message: string } | null }>;
};

function authAdmin(supabase: SupabaseClient): AuthAdmin | null {
  const admin = (supabase as { auth?: { admin?: AuthAdmin } }).auth?.admin;
  if (!admin?.getUserById || !admin.updateUserById) return null;
  return admin;
}

/** Writes the portal role to Auth, public.users, and the tenant membership together. */
export async function syncPortalRole(
  supabase: SupabaseClient,
  input: { userId: string; tenantId: string; role: PortalRole }
): Promise<void> {
  const admin = authAdmin(supabase);
  if (!admin) return;

  const { data, error } = await admin.getUserById(input.userId);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not load the portal account.");
  }

  const current = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: updateError } = await admin.updateUserById(input.userId, {
    app_metadata: {
      ...current,
      platform: current.platform ?? "nexus",
      role: input.role,
      tenant_id: input.tenantId,
    },
  });
  if (updateError) throw new Error(updateError.message);

  const { error: userError } = await supabase.from("users").upsert(
    {
      id: input.userId,
      tenant_id: input.tenantId,
      email: data.user.email ?? null,
      role: input.role,
      is_active: true,
      email_verified: true,
    },
    { onConflict: "id" }
  );
  if (userError) throw new Error(userError.message);

  const { error: membershipError } = await supabase.from("user_roles").upsert(
    {
      user_id: input.userId,
      tenant_id: input.tenantId,
      role: input.role,
      is_active: true,
    },
    { onConflict: "user_id,tenant_id" }
  );
  if (membershipError) throw new Error(membershipError.message);
}
