#!/usr/bin/env node
/**
 * Guard: localhost / CI "development" builds must not use the production Supabase project.
 *
 * Usage:
 *   node scripts/assert-supabase-env.mjs
 *   ALLOW_PRODUCTION_SUPABASE=1 node scripts/assert-supabase-env.mjs   # explicit override (not for local app use)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PRODUCTION_REF = "avhdoifnsnoeavqxnwwm";
const DEVELOPMENT_REF = "mgucromvpnxntwyssltd";

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function projectRefFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

const fileEnv = {
  ...loadDotEnv(resolve(process.cwd(), ".env")),
  ...loadDotEnv(resolve(process.cwd(), ".env.local")),
  ...loadDotEnv(resolve(process.cwd(), ".env.development")),
  ...loadDotEnv(resolve(process.cwd(), ".env.development.local")),
};

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  fileEnv.NEXT_PUBLIC_SUPABASE_URL ||
  fileEnv.SUPABASE_URL ||
  "";

const ref = projectRefFromUrl(url);
const vercelEnv = process.env.VERCEL_ENV; // production | preview | development
const nodeEnv = process.env.NODE_ENV;
const allowProd = process.env.ALLOW_PRODUCTION_SUPABASE === "1";

const isProdTarget =
  vercelEnv === "production" ||
  (nodeEnv === "production" && vercelEnv == null && allowProd);

console.log(
  JSON.stringify(
    {
      detectedUrlHost: url ? new URL(url).hostname : null,
      detectedProjectRef: ref,
      expectedDevelopmentRef: DEVELOPMENT_REF,
      productionRef: PRODUCTION_REF,
      vercelEnv: vercelEnv ?? null,
      nodeEnv: nodeEnv ?? null,
      isProdTarget,
    },
    null,
    2
  )
);

if (!ref) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL is missing or not a *.supabase.co URL.");
  process.exit(1);
}

if (isProdTarget) {
  if (ref !== PRODUCTION_REF) {
    console.error(
      `FAIL: Production target must use ${PRODUCTION_REF}, got ${ref}.`
    );
    process.exit(1);
  }
  console.log("OK: production target uses production Supabase project.");
  process.exit(0);
}

if (ref === PRODUCTION_REF && !allowProd) {
  console.error(
    [
      "FAIL: Non-production runtime is configured with the PRODUCTION Supabase project.",
      `  Current ref: ${PRODUCTION_REF}`,
      `  Required for localhost/Preview: ${DEVELOPMENT_REF}`,
      "  Update NEXT_PUBLIC_SUPABASE_URL / ANON / SUPABASE_SERVICE_ROLE_KEY to development.",
      "  See docs/supabase-environments.md",
    ].join("\n")
  );
  process.exit(1);
}

if (ref !== DEVELOPMENT_REF) {
  console.warn(
    `WARN: Expected development ref ${DEVELOPMENT_REF}, got ${ref}. Confirm this is intentional.`
  );
}

const serviceInPublic =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) ||
  Boolean(fileEnv.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
if (serviceInPublic) {
  console.error("FAIL: SUPABASE_SERVICE_ROLE_KEY must never be NEXT_PUBLIC_*.");
  process.exit(1);
}

console.log("OK: non-production target is not using the production project.");
