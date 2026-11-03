import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeEngagedSeconds } from "@/lib/analytics/kpi-formulas";

export const DEFAULT_IDLE_THRESHOLD_SECONDS = 300;
export const HEARTBEAT_TIMEOUT_SECONDS = 120;

export type SessionHeartbeatInput = {
  tenantId: string;
  userId: string;
  clientSessionKey: string;
  departmentId?: string | null;
  role?: string | null;
  module?: string | null;
  userAgent?: string | null;
  meaningful?: boolean;
  visibilityState?: "visible" | "hidden" | string | null;
  idleThresholdSeconds?: number;
  now?: Date;
};

export type SessionRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  client_session_key: string;
  started_at: string;
  ended_at: string | null;
  last_meaningful_at: string | null;
  last_heartbeat_at: string;
  is_active: boolean;
  logged_in_seconds: number;
  engaged_seconds: number;
  idle_seconds: number;
  activity_count: number;
};

async function getIdleThreshold(
  supabase: SupabaseClient,
  tenantId: string,
  fallback: number,
): Promise<number> {
  const { data } = await supabase
    .from("analytics_tenant_settings")
    .select("idle_threshold_seconds")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const value = Number(data?.idle_threshold_seconds);
  return Number.isFinite(value) && value >= 60 ? value : fallback;
}

/**
 * Upsert an active analytics session and advance engaged time on meaningful heartbeats.
 * Overlapping tabs with the same clientSessionKey share one active row.
 * Cursor movement alone should not call this with meaningful=true.
 */
export async function upsertSessionHeartbeat(
  supabase: SupabaseClient,
  input: SessionHeartbeatInput,
): Promise<{ sessionId: string; engagedSeconds: number; idleSeconds: number }> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const idleThreshold =
    input.idleThresholdSeconds ??
    (await getIdleThreshold(supabase, input.tenantId, DEFAULT_IDLE_THRESHOLD_SECONDS));

  const { data: existing } = await supabase
    .from("analytics_user_sessions")
    .select(
      "id, tenant_id, user_id, client_session_key, started_at, ended_at, last_meaningful_at, last_heartbeat_at, is_active, logged_in_seconds, engaged_seconds, idle_seconds, activity_count",
    )
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("client_session_key", input.clientSessionKey)
    .eq("is_active", true)
    .maybeSingle();

  let session = existing as SessionRow | null;

  if (!session) {
    const { data: created, error } = await supabase
      .from("analytics_user_sessions")
      .insert({
        tenant_id: input.tenantId,
        user_id: input.userId,
        client_session_key: input.clientSessionKey,
        department_id_at_start: input.departmentId ?? null,
        role_at_start: input.role ?? null,
        started_at: nowIso,
        last_meaningful_at: input.meaningful ? nowIso : null,
        last_heartbeat_at: nowIso,
        is_active: true,
        module_at_start: input.module ?? null,
        user_agent: input.userAgent ?? null,
      })
      .select(
        "id, tenant_id, user_id, client_session_key, started_at, ended_at, last_meaningful_at, last_heartbeat_at, is_active, logged_in_seconds, engaged_seconds, idle_seconds, activity_count",
      )
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? "Could not create analytics session");
    }
    session = created as SessionRow;
  }

  const lastHeartbeat = new Date(session.last_heartbeat_at).getTime();
  const lastMeaningful = session.last_meaningful_at
    ? new Date(session.last_meaningful_at).getTime()
    : null;
  const elapsedSinceHeartbeat = Math.max(0, Math.floor((now.getTime() - lastHeartbeat) / 1000));
  const visibilityHidden = input.visibilityState === "hidden";

  let engagedDelta = 0;
  let idleDelta = 0;

  // Only credit engaged time when the tab is visible and a recent meaningful interaction exists.
  if (
    input.meaningful &&
    !visibilityHidden &&
    elapsedSinceHeartbeat > 0 &&
    elapsedSinceHeartbeat <= idleThreshold
  ) {
    engagedDelta = elapsedSinceHeartbeat;
  } else if (
    !visibilityHidden &&
    lastMeaningful != null &&
    now.getTime() - lastMeaningful <= idleThreshold * 1000 &&
    elapsedSinceHeartbeat > 0 &&
    elapsedSinceHeartbeat <= idleThreshold
  ) {
    // Heartbeat without new meaningful event still extends engagement within idle window.
    engagedDelta = Math.min(elapsedSinceHeartbeat, idleThreshold);
  } else if (elapsedSinceHeartbeat > 0) {
    idleDelta = Math.min(elapsedSinceHeartbeat, idleThreshold * 4);
  }

  const startedAt = new Date(session.started_at).getTime();
  const loggedInSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
  const nextEngaged = session.engaged_seconds + engagedDelta;
  const nextIdle = session.idle_seconds + idleDelta;

  if (engagedDelta > 0) {
    const intervalStart = new Date(now.getTime() - engagedDelta * 1000).toISOString();
    await supabase.from("analytics_session_engagement_intervals").insert({
      tenant_id: input.tenantId,
      session_id: session.id,
      user_id: input.userId,
      started_at: intervalStart,
      ended_at: nowIso,
      seconds: engagedDelta,
      source: input.meaningful ? "activity" : "heartbeat",
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("analytics_user_sessions")
    .update({
      last_heartbeat_at: nowIso,
      last_meaningful_at: input.meaningful ? nowIso : session.last_meaningful_at,
      logged_in_seconds: loggedInSeconds,
      engaged_seconds: nextEngaged,
      idle_seconds: nextIdle,
      activity_count: session.activity_count + (input.meaningful ? 1 : 0),
    })
    .eq("id", session.id)
    .eq("tenant_id", input.tenantId)
    .select("id, engaged_seconds, idle_seconds")
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Could not update analytics session");
  }

  return {
    sessionId: String(updated.id),
    engagedSeconds: Number(updated.engaged_seconds) || 0,
    idleSeconds: Number(updated.idle_seconds) || 0,
  };
}

export async function endAnalyticsSession(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    userId: string;
    clientSessionKey: string;
    reason: "logout" | "idle_timeout" | "token_expired" | "heartbeat_timeout" | "replaced" | "manual" | "system";
    now?: Date;
  },
): Promise<void> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const { data: session } = await supabase
    .from("analytics_user_sessions")
    .select("id, started_at, engaged_seconds, idle_seconds")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .eq("client_session_key", input.clientSessionKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!session) return;

  const startedAt = new Date(String(session.started_at)).getTime();
  const loggedInSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));

  await supabase
    .from("analytics_user_sessions")
    .update({
      is_active: false,
      ended_at: nowIso,
      logout_at: input.reason === "logout" ? nowIso : null,
      end_reason: input.reason,
      last_heartbeat_at: nowIso,
      logged_in_seconds: loggedInSeconds,
    })
    .eq("id", session.id)
    .eq("tenant_id", input.tenantId);
}

/** Expire stale active sessions whose heartbeat timed out. */
export async function expireStaleSessions(
  supabase: SupabaseClient,
  tenantId: string,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - HEARTBEAT_TIMEOUT_SECONDS * 1000).toISOString();
  const { data } = await supabase
    .from("analytics_user_sessions")
    .select("id, user_id, client_session_key")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .lt("last_heartbeat_at", cutoff);

  const rows = data ?? [];
  for (const row of rows) {
    await endAnalyticsSession(supabase, {
      tenantId,
      userId: String(row.user_id),
      clientSessionKey: String(row.client_session_key),
      reason: "heartbeat_timeout",
      now,
    });
  }
  return rows.length;
}

export async function computeDedupedEngagedSeconds(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  startIso: string,
  endIso: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("analytics_session_engagement_intervals")
    .select("started_at, ended_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .gte("started_at", startIso)
    .lte("started_at", endIso);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return mergeEngagedSeconds(
    data.map((row) => ({
      startedAt: new Date(String(row.started_at)).getTime(),
      endedAt: new Date(String(row.ended_at ?? row.started_at)).getTime(),
    })),
  );
}
