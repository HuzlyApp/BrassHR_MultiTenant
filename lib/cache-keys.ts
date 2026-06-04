export const CACHE_TTL_SECONDS = {
  searchResults: 60,
  dashboards: 120,
  lists: 300,
  userScoped: 600,
  tenantConfig: 900,
  staticReference: 3600,
} as const;

const CACHE_PREFIX = "supabase";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}

/** Edge-safe deterministic hash for cache key suffixes. */
export function hashQueryParams(params: unknown): string {
  const input = stableStringify(params);
  let h1 = 2166136261;
  let h2 = 2166136261 ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c;
    h2 = Math.imul(h2, 2246822519);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return (part1 + part2).slice(0, 16);
}

function scopeToParts(scope: string | string[]): string[] {
  return Array.isArray(scope) ? scope : scope.split(":").filter(Boolean);
}

export function buildCacheKey(
  table: string,
  scope: string | string[],
  params?: unknown
): string {
  const parts = [CACHE_PREFIX, table, ...scopeToParts(scope)];
  if (params !== undefined) parts.push(hashQueryParams(params));
  return parts.join(":");
}

export function tablePattern(table: string): string {
  return `${CACHE_PREFIX}:${table}:*`;
}

export function tenantPattern(table: string, tenantId: string): string {
  return `${CACHE_PREFIX}:${table}:tenant:${tenantId}:*`;
}

export function userPattern(table: string, userId: string): string {
  return `${CACHE_PREFIX}:${table}:user:${userId}:*`;
}

export function resourcePattern(table: string, resourceId: string): string {
  return `${CACHE_PREFIX}:${table}:resource:${resourceId}:*`;
}
