import "server-only";
import { cookies, headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { STAFF_SESSION_PROOF_COOKIE, verifyStaffSessionProof } from "@/lib/auth/login-otp-proof";

/** Claims are used only after the exact token is verified against Supabase Auth. */
export async function verifiedSessionIdentity() {
  const client = await createClient();
  const bearer = (await headers()).get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const token = bearer || (await client.auth.getSession()).data.session?.access_token;
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return null;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub !== data.user.id || typeof claims.session_id !== "string" || !claims.session_id) return null;
    if (data.user.factors?.some(f => f.status === "verified") && claims.aal !== "aal2") return null;
    return { user: data.user, sessionId: claims.session_id as string };
  } catch { return null; }
}

export async function hasVerifiedStaffSession(user: User): Promise<boolean> {
  const identity = await verifiedSessionIdentity();
  if (!identity || identity.user.id !== user.id) return false;
  return verifyStaffSessionProof(user.id, identity.sessionId, (await cookies()).get(STAFF_SESSION_PROOF_COOKIE)?.value);
}
