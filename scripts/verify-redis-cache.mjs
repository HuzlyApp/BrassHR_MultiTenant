/**
 * Verifies Redis connectivity and cache hit/miss behavior.
 * Usage: node scripts/verify-redis-cache.mjs
 * Does not print secrets.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "redis";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function pingRedis(label, url) {
  const client = createClient({ url });
  try {
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return { label, ok: pong === "PONG", pong };
  } catch (e) {
    try {
      await client.quit();
    } catch {
      /* ignore */
    }
    return {
      label,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

loadEnvFile();

const cacheEnabled = process.env.CACHE_ENABLED === "true";
const redisUrl = process.env.REDIS_URL?.trim() ?? "";
const perfLog = process.env.PERF_LOG === "true";

console.log("[verify-redis] CACHE_ENABLED=", cacheEnabled);
console.log("[verify-redis] REDIS_URL set=", Boolean(redisUrl));
console.log("[verify-redis] REDIS_URL length=", redisUrl.length);
console.log("[verify-redis] REDIS_TOKEN set=", Boolean(process.env.REDIS_TOKEN?.trim()));
console.log("[verify-redis] PERF_LOG=", perfLog);

if (!cacheEnabled) {
  console.error("[verify-redis] FAIL: CACHE_ENABLED is not true");
  process.exit(1);
}

if (!redisUrl) {
  console.error("[verify-redis] FAIL: REDIS_URL is missing");
  process.exit(1);
}

const variants = [{ label: "REDIS_URL as-is", url: redisUrl }];
if (redisUrl.startsWith("redis://")) {
  variants.push({
    label: "REDIS_URL with TLS (rediss://)",
    url: redisUrl.replace(/^redis:\/\//, "rediss://"),
  });
}

let connected = null;
for (const v of variants) {
  const result = await pingRedis(v.label, v.url);
  console.log("[verify-redis] ping", result);
  if (result.ok) {
    connected = v.url;
    break;
  }
}

if (!connected) {
  console.error(
    "[verify-redis] FAIL: Could not PING Redis. Check password, username, and whether TLS (rediss://) is required.",
  );
  process.exit(1);
}

console.log("[verify-redis] OK: Redis PONG via", connected.startsWith("rediss://") ? "TLS" : "plain");

// Cache round-trip using the working URL
process.env.REDIS_URL = connected;
const client = createClient({ url: connected });
await client.connect();

const testKey = `supabase:verify:${Date.now()}`;
const testValue = JSON.stringify({ ok: true, ts: Date.now() });

await client.set(testKey, testValue, { EX: 60 });
const first = await client.get(testKey);
const second = await client.get(testKey);
await client.del(testKey);
await client.quit();

console.log("[verify-redis] cache write/read OK=", first === testValue && second === testValue);
console.log("[verify-redis] sample payload bytes=", Buffer.byteLength(testValue, "utf8"));
