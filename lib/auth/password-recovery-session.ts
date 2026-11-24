import type { Session } from "@supabase/supabase-js";

export type PasswordRecoveryLinkParams = {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
};

export type PasswordRecoverySessionPlan =
  | "verify-link"
  | "reuse-recovery-session"
  | "reject";

export function readPasswordRecoveryLinkParams(search: {
  get(name: string): string | null;
}): PasswordRecoveryLinkParams {
  const tokenHash = search.get("token_hash")?.trim() || null;
  const type = search.get("type")?.trim() || null;
  const code = search.get("code")?.trim() || null;
  return { tokenHash, type, code };
}

export function passwordRecoveryLinkIsPresent(link: PasswordRecoveryLinkParams): boolean {
  if (link.tokenHash && (link.type ?? "recovery") === "recovery") return true;
  return Boolean(link.code);
}

function amrMethodsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const methods: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      methods.push(entry.trim().toLowerCase());
      continue;
    }
    if (entry && typeof entry === "object" && "method" in entry) {
      const method = (entry as { method?: unknown }).method;
      if (typeof method === "string" && method.trim()) {
        methods.push(method.trim().toLowerCase());
      }
    }
  }
  return methods;
}

function decodeJwtPayload(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob === "function") return atob(padded);
  return Buffer.from(padded, "base64").toString("utf8");
}

function amrMethodsFromJwt(accessToken: string | null | undefined): string[] {
  if (!accessToken) return [];
  const parts = accessToken.split(".");
  if (parts.length < 2) return [];
  try {
    const payload = JSON.parse(decodeJwtPayload(parts[1])) as { amr?: unknown };
    return amrMethodsFromUnknown(payload.amr);
  } catch {
    return [];
  }
}

const PASSWORD_SETUP_AMR_METHODS = new Set(["recovery", "invite"]);

/** A recovery form is bound to one Auth identity and one session, including refreshes. */
export function passwordRecoverySessionMatches(
  current: Session | null | undefined,
  verified: Session | null | undefined
): boolean {
  if (!current?.user.id || current.user.id !== verified?.user.id) return false;
  const sessionId = (session: Session): string | null => {
    try {
      const payload = JSON.parse(decodeJwtPayload(session.access_token.split(".")[1])) as { session_id?: unknown };
      return typeof payload.session_id === "string" && payload.session_id ? payload.session_id : null;
    } catch { return null; }
  };
  const expected = sessionId(verified);
  return Boolean(expected && sessionId(current) === expected);
}

/** True only when this session was created from a recovery / invite link. */
export function authSessionIsPasswordRecovery(session: Session | null | undefined): boolean {
  if (!session?.access_token) return false;
  const fromJwt = amrMethodsFromJwt(session.access_token);
  const fromSession = amrMethodsFromUnknown((session as { amr?: unknown }).amr);
  const fromUser = amrMethodsFromUnknown((session.user as { amr?: unknown } | undefined)?.amr);
  return [...fromJwt, ...fromSession, ...fromUser].some((method) =>
    PASSWORD_SETUP_AMR_METHODS.has(method)
  );
}

/**
 * Invite / reset links must never update the password of whoever is already
 * signed in (for example a tenant admin testing a recruiter invite).
 */
export function planPasswordRecoverySession(params: {
  hasExistingSession: boolean;
  sessionIsRecovery: boolean;
  link: PasswordRecoveryLinkParams;
}): PasswordRecoverySessionPlan {
  if (passwordRecoveryLinkIsPresent(params.link)) return "verify-link";
  if (params.hasExistingSession && params.sessionIsRecovery) return "reuse-recovery-session";
  return "reject";
}
