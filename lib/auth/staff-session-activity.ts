import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Only OTP/OAuth binding starts a session. Normal reads never extend idle expiry. */
export async function checkStaffSessionActivity(userId: string, sessionId: string, action: "check" | "start" | "touch" = "check", accessToken?: string): Promise<boolean> {
  try {
    const svc = createServiceRoleClient();
    if (!svc) return false;
    const { data, error } = await svc.rpc("check_staff_session_activity", {
      p_user_id: userId, p_session_id: sessionId, p_action: action,
    });
    if (error) return false;
    if (data !== true && accessToken) {
      // Revoke refresh tokens for this session only, preserving other devices.
      await svc.auth.admin.signOut(accessToken, "local");
    }
    return data === true;
  } catch { return false; }
}
