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

const id = process.argv[2];
if (!id) {
  console.error("Usage: node scripts/poll-vercel-deployment.mjs <deploymentId>");
  process.exit(1);
}

for (let i = 0; i < 40; i++) {
  const url = `https://api.vercel.com/v13/deployments/${id}?teamId=${process.env.VERCEL_TEAM_ID}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
  const j = await res.json();
  const state = j.readyState || j.status;
  console.log(
    JSON.stringify({
      attempt: i + 1,
      readyState: state,
      url: j.url ? `https://${j.url}` : null,
      errorMessage: j.errorMessage || null,
    })
  );
  if (state === "READY") process.exit(0);
  if (state === "ERROR" || state === "CANCELED") process.exit(1);
  await new Promise((r) => setTimeout(r, 10000));
}
process.exit(2);
