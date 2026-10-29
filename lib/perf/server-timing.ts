import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";

export type ServerTimingScope = "middleware" | "handler";

export type ServerTimingMetric = {
  name: string;
  dur: number;
  desc?: string;
};

type TimingStore = {
  scope: ServerTimingScope;
  route: string;
  method: string;
  tenantSlug: string | null;
  tenantId: string | null;
  cacheHit: boolean | null;
  cacheSource: string | null;
  metrics: ServerTimingMetric[];
  logged: boolean;
  startedAt: number;
};

export type ServerTimingMeta = {
  scope: ServerTimingScope;
  route: string;
  method: string;
  tenantSlug?: string | null;
};

const als = new AsyncLocalStorage<TimingStore>();

const NAME_RE = /[^a-zA-Z0-9!#$%&'*+.^_`|~-]/g;
const DESC_RE = /[^a-zA-Z0-9 _.:/=-]/g;

function createStore(meta: ServerTimingMeta): TimingStore {
  return {
    scope: meta.scope,
    route: meta.route,
    method: meta.method,
    tenantSlug: meta.tenantSlug?.trim() || null,
    tenantId: null,
    cacheHit: null,
    cacheSource: null,
    metrics: [],
    logged: false,
    startedAt: performance.now(),
  };
}

export function recordServerTiming(name: string, durMs: number, desc?: string): void {
  const store = als.getStore();
  if (!store) return;
  const safeName = name.replace(NAME_RE, "") || "span";
  store.metrics.push({
    name: safeName,
    dur: Math.max(0, durMs),
    ...(desc ? { desc } : {}),
  });
}

export async function timeSpan<T>(name: string, fn: () => PromiseLike<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordServerTiming(name, performance.now() - start);
  }
}

export function noteServerTimingTenant(tenantId: string | null | undefined): void {
  const store = als.getStore();
  if (!store || !tenantId) return;
  store.tenantId = tenantId;
}

export function noteServerTimingCache(hit: boolean, source: "memory" | "redis" | "miss"): void {
  const store = als.getStore();
  if (!store) return;
  store.cacheHit = hit;
  store.cacheSource = source;
}

export function formatServerTiming(metrics: readonly ServerTimingMetric[]): string {
  return metrics
    .map((metric) => {
      const name = metric.name.replace(NAME_RE, "") || "span";
      const dur = Math.round(metric.dur * 10) / 10;
      if (!metric.desc) return `${name};dur=${dur}`;
      const desc = metric.desc.replace(DESC_RE, "").slice(0, 120);
      return `${name};dur=${dur};desc="${desc}"`;
    })
    .join(", ");
}

export function applyServerTiming(response: Response): void {
  const store = als.getStore();
  if (!store || store.metrics.length === 0) return;
  const value = formatServerTiming(store.metrics);
  if (!value) return;
  const existing = response.headers.get("Server-Timing");
  response.headers.set("Server-Timing", existing ? `${existing}, ${value}` : value);
}

function staffRoute(route: string): boolean {
  return (
    route.startsWith("/admin_recruiter") ||
    route.startsWith("/api/admin") ||
    route.startsWith("/godadmin") ||
    route.startsWith("/api/godadmin")
  );
}

function writeServerTimingLog(store: TimingStore): void {
  if (store.logged) return;
  const measured = store.metrics.some(
    (metric) => metric.name !== "mw" && metric.name !== "handler" && metric.name !== "handler-auth",
  );
  if (!measured && !staffRoute(store.route)) return;
  store.logged = true;
  const total = store.metrics.find((metric) => metric.name === "mw" || metric.name === "handler");
  console.info("[server-timing]", {
    scope: store.scope,
    route: store.route,
    method: store.method,
    tenantSlug: store.tenantSlug,
    tenantId: store.tenantId,
    cacheHit: store.cacheHit,
    cacheSource: store.cacheSource,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    totalMs: total ? Math.round(total.dur * 10) / 10 : Math.round((performance.now() - store.startedAt) * 10) / 10,
    spans: store.metrics.map((metric) => ({
      name: metric.name,
      dur: Math.round(metric.dur * 10) / 10,
    })),
  });
}

export function logServerTiming(): void {
  const store = als.getStore();
  if (!store) return;
  writeServerTimingLog(store);
}

export function completeHandlerTiming(store: TimingStore | null): void {
  if (!store || store.logged) return;
  store.metrics.push({
    name: "handler",
    dur: Math.max(0, performance.now() - store.startedAt),
  });
  writeServerTimingLog(store);
}

export async function runWithServerTiming<T extends Response>(
  meta: ServerTimingMeta,
  fn: () => Promise<T>,
): Promise<T> {
  if (als.getStore()) return fn();
  const store = createStore(meta);
  return als.run(store, async () => {
    const started = performance.now();
    try {
      const response = await fn();
      recordServerTiming(meta.scope === "middleware" ? "mw" : "handler", performance.now() - started);
      applyServerTiming(response);
      return response;
    } catch (error) {
      recordServerTiming(meta.scope === "middleware" ? "mw" : "handler", performance.now() - started);
      throw error;
    } finally {
      logServerTiming();
    }
  });
}

/** Keep handler spans alive until the route builds its response. */
export function enterHandlerServerTiming(meta: Omit<ServerTimingMeta, "scope">): TimingStore | null {
  if (als.getStore()) return null;
  const store = createStore({ ...meta, scope: "handler" });
  als.enterWith(store);
  return store;
}

let responseJsonPatched = false;

export function installHandlerResponseTiming(): void {
  if (responseJsonPatched) return;
  responseJsonPatched = true;
  const original = NextResponse.json.bind(NextResponse);
  NextResponse.json = ((body, init) => {
    const response = original(body, init);
    if (als.getStore()?.scope === "handler") applyServerTiming(response);
    return response;
  }) as typeof NextResponse.json;
}
