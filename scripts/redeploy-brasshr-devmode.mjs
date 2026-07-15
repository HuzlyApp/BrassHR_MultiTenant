#!/usr/bin/env node
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
const projectId = "prj_qUEWmWGKw3f5HdncL3Z5sxUWkTsP";

async function api(path, opts = {}) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const project = await api(`/v9/projects/${projectId}`);
const link = project.link || {};
const ref = link.productionBranch || "main";
const repoId = link.repoId;
const gitSource = repoId
  ? { type: "github", repoId, ref }
  : { type: "github", org: link.org, repo: link.repo, ref };

const result = await api(`/v13/deployments`, {
  method: "POST",
  body: JSON.stringify({
    name: project.name,
    project: projectId,
    gitSource,
    target: "production",
  }),
});

console.log(
  JSON.stringify(
    {
      created: {
        id: result.id || result.uid,
        url: result.url ? `https://${result.url}` : null,
        inspectorUrl: result.inspectorUrl || null,
        readyState: result.readyState || null,
        target: result.target || null,
        ref,
      },
      stableAlias: "https://brasshr-devmode.vercel.app",
    },
    null,
    2
  )
);
