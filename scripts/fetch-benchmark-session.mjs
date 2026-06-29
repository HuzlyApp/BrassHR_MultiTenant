/**
 * Obtain a Supabase access token for benchmark scripts.
 *
 * Usage:
 *   BENCHMARK_EMAIL=... BENCHMARK_PASSWORD=... node scripts/fetch-benchmark-session.mjs
 *
 * Prints:
 *   BENCHMARK_BEARER=<access_token>
 *   (or existing BENCHMARK_COOKIE if set)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const email = process.env.BENCHMARK_EMAIL?.trim();
const password = process.env.BENCHMARK_PASSWORD?.trim();

if (process.env.BENCHMARK_COOKIE?.trim()) {
  console.log("BENCHMARK_COOKIE already set (length:", process.env.BENCHMARK_COOKIE.trim().length, ")");
  process.exit(0);
}

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

if (!email || !password) {
  console.error("Set BENCHMARK_EMAIL and BENCHMARK_PASSWORD, or BENCHMARK_COOKIE directly.");
  process.exit(1);
}

const supabase = createClient(url, anon);
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error || !data.session?.access_token) {
  console.error("Sign-in failed:", error?.message ?? "no session");
  process.exit(1);
}

console.log("BENCHMARK_BEARER=" + data.session.access_token);
console.log("user_id=" + data.user.id);
console.log("email=" + (data.user.email ?? ""));
