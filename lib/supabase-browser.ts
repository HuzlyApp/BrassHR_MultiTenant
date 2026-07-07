"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseBackendId } from "@/lib/supabase/backend-config";
import { getCookieBackendId, SUPABASE_BACKEND_COOKIE } from "@/lib/supabase/request-backend";

type RuntimeConfig = {
  backend: SupabaseBackendId;
  url: string;
  anonKey: string;
};

let client: SupabaseClient | undefined;
let runtimeConfig: RuntimeConfig | undefined;
let runtimePromise: Promise<RuntimeConfig | null> | null = null;

function readCookieBackend(): SupabaseBackendId | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SUPABASE_BACKEND_COOKIE}=`));
  return getCookieBackendId(match?.split("=")[1]);
}

function readPrimaryEnvConfig(): RuntimeConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { backend: "primary", url, anonKey };
}

function readFallbackEnvConfig(): RuntimeConfig | null {
  const url = process.env.FALLBACK_NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.FALLBACK_NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { backend: "fallback", url, anonKey };
}

function resolveEnvConfig(backendId?: SupabaseBackendId | null): RuntimeConfig | null {
  const backend = backendId ?? readCookieBackend() ?? "primary";
  if (backend === "fallback") {
    return readFallbackEnvConfig() ?? readPrimaryEnvConfig();
  }
  return readPrimaryEnvConfig();
}

function applyRuntimeConfig(config: RuntimeConfig): SupabaseClient {
  if (
    client &&
    runtimeConfig?.url === config.url &&
    runtimeConfig?.anonKey === config.anonKey
  ) {
    return client;
  }
  client = createBrowserClient(config.url, config.anonKey);
  runtimeConfig = config;
  return client;
}

async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  if (runtimeConfig) return runtimeConfig;

  try {
    const response = await fetch("/api/supabase-runtime", { cache: "no-store" });
    if (response.ok) {
      const json = (await response.json()) as RuntimeConfig;
      if (json?.url && json?.anonKey) {
        runtimeConfig = {
          backend: json.backend ?? readCookieBackend() ?? "primary",
          url: json.url,
          anonKey: json.anonKey,
        };
        applyRuntimeConfig(runtimeConfig);
        return runtimeConfig;
      }
    }
  } catch {
    /* fall through to env + cookie */
  }

  const envConfig = resolveEnvConfig();
  if (!envConfig) return null;
  runtimeConfig = envConfig;
  applyRuntimeConfig(runtimeConfig);
  return runtimeConfig;
}

function ensureRuntimePrefetch(): void {
  if (typeof window === "undefined") return;
  runtimePromise ??= loadRuntimeConfig();
}

function getClient(): SupabaseClient {
  if (client && runtimeConfig) return client;

  const envConfig = resolveEnvConfig();
  if (envConfig) {
    return applyRuntimeConfig(envConfig);
  }

  throw new Error(
    "Missing Supabase URL or anon key (NEXT_PUBLIC_* or FALLBACK_NEXT_PUBLIC_* in .env.local)",
  );
}

if (typeof window !== "undefined") {
  ensureRuntimePrefetch();
}

/**
 * Lazy browser client so modules can load during `next build` without Supabase env.
 * Honors `sb-backend` cookie and `/api/supabase-runtime` before defaulting to primary.
 */
export const supabaseBrowser = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = getClient();
    const value = Reflect.get(c, prop, receiver);
    return typeof value === "function" ? value.bind(c) : value;
  },
});

/** Await resolved backend (from health check) before password sign-in and other auth calls. */
export async function getSupabaseBrowserRuntime(): Promise<SupabaseClient> {
  ensureRuntimePrefetch();
  const runtime = await (runtimePromise ?? loadRuntimeConfig());
  if (!runtime) {
    throw new Error("Missing Supabase runtime configuration");
  }
  return applyRuntimeConfig(runtime);
}
