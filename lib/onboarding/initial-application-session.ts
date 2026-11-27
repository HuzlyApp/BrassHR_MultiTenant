import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Call only after getUser verifies the exact bearer token. */
export async function checkInitialApplicationSession(svc: SupabaseClient, user: User, token: string, tenantId: string | null, jobToken: string | null, start = false): Promise<boolean> {
  if (!user.is_anonymous) return true;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub !== user.id || typeof claims.session_id !== "string") return false;
    const { data, error } = await svc.rpc("check_initial_application_session", {
      p_user_id: user.id, p_session_id: claims.session_id, p_tenant_id: tenantId,
      p_job_token: jobToken, p_start: start,
    });
    return !error && data === true;
  } catch { return false; }
}
