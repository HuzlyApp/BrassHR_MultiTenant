#!/usr/bin/env node
/**
 * Find brasshr-devmode project and classify its Supabase env refs (no secret values).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;
if (!token || !teamId) {
  console.error("Need VERCEL_TOKEN and VERCEL_TEAM_ID");
  process.exit(1);
}

async function api(path) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function jwtMeta(value) {
  if (!value || typeof value !== "string" || !value.startsWith("eyJ")) return null;
  try {
    return JSON.parse(
      Buffer.from(value.split(".")[1], "base64url").toString("utf8")
    );
  } catch {
    return null;
  }
}

function urlRef(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return new URL(value).hostname.split(".")[0];
  } catch {
    return null;
  }
}

const KNOWN = {
  avhdoifnsnoeavqxnwwm: "production",
  qowirmiicsrglehiaoil: "staging-preview-branch",
  mgucromvpnxntwyssltd: "south-legacy",
};

const projects = await api(`/v9/projects`);
const list = projects.projects || projects || [];
const match = list.filter((p) =>
  /brass|devmode|staging|multi/i.test(p.name || "")
);

console.log(
  JSON.stringify(
    {
      matchingProjects: match.map((p) => ({
        id: p.id,
        name: p.name,
        framework: p.framework,
      })),
    },
    null,
    2
  )
);

let target =
  match.find((p) => /devmode|development/i.test(p.name)) ||
  match.find((p) => p.name === "brasshr_development") ||
  null;

if (!target) {
  // try domain lookup
  for (const p of list) {
    try {
      const domains = await api(`/v9/projects/${p.id}/domains`);
      const names = (domains.domains || domains || []).map((d) => d.name);
      if (names.some((n) => /brasshr-devmode/i.test(n))) {
        target = p;
        console.log(
          JSON.stringify(
            { foundByDomain: { id: p.id, name: p.name, names } },
            null,
            2
          )
        );
        break;
      }
    } catch {
      /* ignore */
    }
  }
}

if (!target) {
  console.error("Could not find brasshr-devmode / brasshr_development project");
  process.exit(1);
}

const project = await api(`/v9/projects/${target.id}`);
const envs = await api(`/v9/projects/${target.id}/env`);
const envList = envs.envs || [];
const interesting = envList.filter((e) =>
  /SUPABASE|DATABASE|DIRECT|NEXT_PUBLIC_APP_URL|ROOT_DOMAIN/i.test(e.key)
);

const classified = [];
for (const e of interesting) {
  let value = e.value;
  let decryptStatus = "list-value";
  try {
    const full = await api(
      `/v1/projects/${target.id}/env/${e.id}?decrypt=true`
    );
    if (full.value) {
      value = full.value;
      decryptStatus = "decrypted";
    } else {
      decryptStatus = "empty-after-decrypt";
    }
  } catch (err) {
    decryptStatus = `fail:${err instanceof Error ? err.message.slice(0, 80) : "err"}`;
  }

  const meta = jwtMeta(value);
  const ref = meta?.ref || urlRef(value);
  classified.push({
    key: e.key,
    target: e.target,
    gitBranch: e.gitBranch || null,
    type: e.type,
    decryptStatus,
    role: meta?.role || null,
    envRole: ref ? KNOWN[ref] || "unknown" : null,
    supabaseRef: ref || null,
    present: Boolean(value),
  });
}

const domains = await api(`/v9/projects/${target.id}/domains`);

console.log(
  JSON.stringify(
    {
      project: {
        id: target.id,
        name: target.name,
        productionBranch: project.link?.productionBranch || null,
        repo: project.link
          ? `${project.link.org}/${project.link.repo}`
          : null,
      },
      domains: (domains.domains || domains || []).map((d) => ({
        name: d.name,
        gitBranch: d.gitBranch || null,
      })),
      supabaseEnvs: classified,
      diagnosis: {
        hasServiceRolePreview: classified.some(
          (c) =>
            c.key === "SUPABASE_SERVICE_ROLE_KEY" &&
            (c.target || []).includes("production") &&
            c.role === "service_role"
        ),
        serviceRoleIsAnon: classified.some(
          (c) =>
            c.key === "SUPABASE_SERVICE_ROLE_KEY" && c.role === "anon"
        ),
        previewUsesStaging: classified.some(
          (c) =>
            c.key.includes("SUPABASE_URL") &&
            c.envRole === "staging-preview-branch"
        ),
      },
    },
    null,
    2
  )
);
