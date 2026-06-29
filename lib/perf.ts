import "server-only";

export type PerfFields = Record<string, string | number | boolean | null | undefined>;

function perfEnabled(): boolean {
  return process.env.PERF_LOG === "true" || process.env.NODE_ENV !== "production";
}

export function logPerf(route: string, fields: PerfFields = {}): void {
  if (!perfEnabled()) return;
  const payload = Object.fromEntries(
    Object.entries({ route, ...fields }).filter(([, v]) => v !== undefined),
  );
  console.info("[perf]", payload);
}

export function logSupabaseQuery(
  name: string,
  fields: { ms: number; rows?: number; tenantId?: string | null } & PerfFields,
): void {
  if (!perfEnabled()) return;
  console.info("[supabase-query]", { name, ...fields });
}

export function createPerfTimer(): { elapsedMs: () => number } {
  const start = performance.now();
  return { elapsedMs: () => Math.round(performance.now() - start) };
}

export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  extra?: PerfFields,
): Promise<{ result: T; ms: number }> {
  const timer = createPerfTimer();
  const result = await fn();
  const ms = timer.elapsedMs();
  logSupabaseQuery(label, { ms, ...extra });
  return { result, ms };
}
