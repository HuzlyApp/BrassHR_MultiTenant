#!/usr/bin/env node
/**
 * Point brasshr_development (brasshr-devmode.vercel.app) at staging PREVIEW Supabase.
 * Uses local .env staging keys. Never prints secret values.
 *
 * Usage:
 *   node scripts/vercel-set-devmode-staging-envs.mjs --dry-run
 *   node scripts/vercel-set-devmode-staging-envs.mjs --apply
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadDotEnv() {
  for (const name of [".env", ".env.local"]) {
    const path = join(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadDotEnv();

const STAGING_REF = "qowirmiicsrglehiaoil";
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const DEVMODE_PROJECT_ID = "prj_qUEWmWGKw3f5HdncL3Z5sxUWkTsP";
const DEVMODE_APP_URL = "https://brasshr-devmode.vercel.app";

const vercelToken = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply");

if (!apply && !dryRun) {
  console.error("Usage: --dry-run | --apply");
  process.exit(1);
}
if (!vercelToken || !teamId) {
  console.error("Need VERCEL_TOKEN and VERCEL_TEAM_ID");
  process.exit(1);
}

function jwtMeta(value) {
  if (!value?.startsWith("eyJ")) return null;
  try {
    return JSON.parse(
      Buffer.from(value.split(".")[1], "base64url").toString("utf8")
    );
  } catch {
    return null;
  }
}

function urlRef(value) {
  try {
    return new URL(value).hostname.split(".")[0];
  } catch {
    return null;
  }
}

async function api(path, opts = {}) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const localAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const localService = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (urlRef(localUrl) !== STAGING_REF) {
  console.error(
    JSON.stringify({
      error: "Local NEXT_PUBLIC_SUPABASE_URL must be staging PREVIEW",
      got: urlRef(localUrl),
      expected: STAGING_REF,
    })
  );
  process.exit(1);
}
if (jwtMeta(localAnon)?.ref !== STAGING_REF || jwtMeta(localAnon)?.role !== "anon") {
  console.error(JSON.stringify({ error: "Local anon key is not staging anon" }));
  process.exit(1);
}
if (
  jwtMeta(localService)?.ref !== STAGING_REF ||
  jwtMeta(localService)?.role !== "service_role"
) {
  console.error(JSON.stringify({ error: "Local service role key is not staging service_role" }));
  process.exit(1);
}

const desired = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    value: STAGING_URL,
    ref: STAGING_REF,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    value: localAnon,
    ref: STAGING_REF,
    role: "anon",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    value: localService,
    ref: STAGING_REF,
    role: "service_role",
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    value: DEVMODE_APP_URL,
    ref: null,
  },
];

const envs = await api(`/v9/projects/${DEVMODE_PROJECT_ID}/env`);
const list = envs.envs || [];

const plan = desired.map((d) => {
  const existing = list.filter((e) => e.key === d.key);
  return {
    key: d.key,
    action: existing.length ? "patch-all-matching" : "create",
    existingIds: existing.map((e) => e.id),
    existingTargets: existing.map((e) => e.target),
    valueRef: d.ref,
    valueRole: d.role || null,
  };
});

const report = {
  dryRun,
  apply,
  projectId: DEVMODE_PROJECT_ID,
  projectName: "brasshr_development",
  domain: DEVMODE_APP_URL,
  stagingRef: STAGING_REF,
  plan,
};

const dir = join(process.cwd(), "reports");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "vercel-devmode-staging-env-plan.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (dryRun) {
  console.error("Dry-run only. Re-run with --apply to update brasshr_development.");
  process.exit(0);
}

const results = [];
for (const d of desired) {
  const existing = list.filter((e) => e.key === d.key);
  if (existing.length === 0) {
    const created = await api(`/v10/projects/${DEVMODE_PROJECT_ID}/env`, {
      method: "POST",
      body: JSON.stringify({
        key: d.key,
        value: d.value,
        type: "sensitive",
        target: ["production", "preview"],
      }),
    });
    results.push({
      key: d.key,
      step: "create",
      id: created.created?.id || created.id || null,
    });
    continue;
  }

  for (const row of existing) {
    // Sensitive vars: omit type on PATCH
    await api(`/v9/projects/${DEVMODE_PROJECT_ID}/env/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        value: d.value,
        target: ["production", "preview"],
      }),
    });
    results.push({ key: d.key, step: "patch", id: row.id });
  }
}

writeFileSync(
  join(dir, "vercel-devmode-staging-env-apply.json"),
  JSON.stringify({ appliedAt: new Date().toISOString(), results }, null, 2)
);
console.log(JSON.stringify({ applied: true, results }, null, 2));
console.error(
  "Done. Redeploy brasshr_development so https://brasshr-devmode.vercel.app picks up env vars."
);
