#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

for (const name of [".env", ".env.local"]) {
  const p = join(process.cwd(), name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID;

async function api(path) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const domains = await api(`/v9/projects/${projectId}/domains`);
const list = (domains.domains || domains || []).map((d) => ({
  name: d.name,
  gitBranch: d.gitBranch || null,
  redirect: d.redirect || null,
  verified: d.verified,
}));

const deps = await api(`/v6/deployments?projectId=${projectId}&limit=30`);
const staging = (deps.deployments || [])
  .filter((d) => d.meta?.githubCommitRef === "staging")
  .slice(0, 5)
  .map((d) => ({
    state: d.state,
    url: d.url ? `https://${d.url}` : null,
    branchAlias: d.meta?.branchAlias || null,
    target: d.target || "preview",
  }));

console.log(
  JSON.stringify(
    {
      stagingDeploys: staging,
      domainsWithGitBranch: list.filter((d) => d.gitBranch),
      hasStagingDomain: list.some((d) => d.name === "staging.brasshr.com"),
      hasAppDomain: list.some((d) => d.name === "app.brasshr.com"),
      customDomains: list.map((d) => ({
        name: d.name,
        gitBranch: d.gitBranch,
      })),
    },
    null,
    2
  )
);
