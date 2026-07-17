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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceMeta = jwtMeta(service);
const anonMeta = jwtMeta(anon);
let urlRef = null;
try {
  urlRef = new URL(url).hostname.split(".")[0];
} catch {
  /* ignore */
}

console.log(
  JSON.stringify(
    {
      urlRef,
      serviceRole: serviceMeta
        ? { ref: serviceMeta.ref, role: serviceMeta.role }
        : null,
      anon: anonMeta ? { ref: anonMeta.ref, role: anonMeta.role } : null,
      refsMatch:
        Boolean(urlRef) &&
        urlRef === serviceMeta?.ref &&
        urlRef === anonMeta?.ref,
      serviceIsServiceRole: serviceMeta?.role === "service_role",
    },
    null,
    2
  )
);
