import {
  getBackendConfigById,
  getFallbackBackendConfig,
  getPrimaryBackendConfig,
  type SupabaseBackendConfig,
  type SupabaseBackendId,
} from "@/lib/supabase/backend-config";

const HEALTH_CHECK_TIMEOUT_MS = 5_000;
const PRIMARY_RECOVERY_PROBE_MS = 60_000;

type BackendHealthState = {
  activeBackend: SupabaseBackendId;
  primaryHealthy: boolean;
  lastPrimaryCheckAt: number;
  lastSwitchAt: number;
};

const globalState = globalThis as typeof globalThis & {
  __brasshrSupabaseBackendState?: BackendHealthState;
};

function getState(): BackendHealthState {
  if (!globalState.__brasshrSupabaseBackendState) {
    globalState.__brasshrSupabaseBackendState = {
      activeBackend: "primary",
      primaryHealthy: true,
      lastPrimaryCheckAt: 0,
      lastSwitchAt: 0,
    };
  }
  return globalState.__brasshrSupabaseBackendState;
}

function isUnavailableResponse(status: number): boolean {
  return status === 522 || status === 523 || status === 524 || status >= 500;
}

function isRetryableNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
      : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("connect timeout") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("abort") ||
    normalized.includes("network") ||
    normalized.includes("connection terminated")
  );
}

export async function probeSupabaseBackendHealth(
  config: SupabaseBackendConfig,
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.url.replace(/\/+$/, "")}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (isUnavailableResponse(response.status)) return false;
    return true;
  } catch (error) {
    return !isRetryableNetworkError(error) ? false : false;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshPrimaryHealthIfStale(force = false): Promise<void> {
  const state = getState();
  const primary = getPrimaryBackendConfig();
  const fallback = getFallbackBackendConfig();
  if (!primary) return;
  if (!fallback) {
    state.activeBackend = "primary";
    state.primaryHealthy = true;
    return;
  }

  const now = Date.now();
  const probeDue =
    force ||
    now - state.lastPrimaryCheckAt >= PRIMARY_RECOVERY_PROBE_MS ||
    (state.activeBackend === "fallback" && now - state.lastSwitchAt >= PRIMARY_RECOVERY_PROBE_MS);

  if (!probeDue) return;

  state.lastPrimaryCheckAt = now;
  const healthy = await probeSupabaseBackendHealth(primary);
  state.primaryHealthy = healthy;

  if (healthy && state.activeBackend === "fallback") {
    state.activeBackend = "primary";
    state.lastSwitchAt = now;
    console.info("[supabase] primary backend recovered — switching back to primary");
    return;
  }

  if (!healthy && state.activeBackend === "primary") {
    state.activeBackend = "fallback";
    state.lastSwitchAt = now;
    console.warn("[supabase] primary backend unavailable — switching to fallback (brasshr_south)");
  }
}

export async function resolveActiveSupabaseBackend(
  options?: { forceHealthCheck?: boolean },
): Promise<SupabaseBackendConfig | null> {
  const primary = getPrimaryBackendConfig();
  const fallback = getFallbackBackendConfig();
  if (!primary && !fallback) return null;
  if (!fallback) return primary;
  if (!primary) return fallback;

  await refreshPrimaryHealthIfStale(options?.forceHealthCheck === true);

  const state = getState();
  if (state.activeBackend === "fallback" && !state.primaryHealthy) {
    return fallback;
  }
  return primary;
}

export function getStickySupabaseBackendId(): SupabaseBackendId {
  return getState().activeBackend;
}

export function pinSupabaseBackendForRequest(backendId: SupabaseBackendId): void {
  const state = getState();
  state.activeBackend = backendId;
}

export function markPrimaryBackendFailure(): void {
  const fallback = getFallbackBackendConfig();
  if (!fallback) return;
  const state = getState();
  state.primaryHealthy = false;
  state.activeBackend = "fallback";
  state.lastSwitchAt = Date.now();
  state.lastPrimaryCheckAt = Date.now();
  console.warn("[supabase] primary request failed — pinned to fallback for this process");
}

export function getResolvedBackendConfig(
  backendId?: SupabaseBackendId,
): SupabaseBackendConfig | null {
  const id = backendId ?? getStickySupabaseBackendId();
  return getBackendConfigById(id);
}
