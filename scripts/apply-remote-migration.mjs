import fs from "node:fs";
import path from "node:path";

const PROJECT_REF = "qowirmiicsrglehiaoil";
const MIGRATION_FILE = process.argv[2];
const MIGRATION_NAME = process.argv[3];

if (!MIGRATION_FILE || !MIGRATION_NAME) {
  console.error("Usage: node scripts/apply-remote-migration.mjs <migration.sql> <migration_name>");
  process.exit(1);
}

function readEnvValue(key) {
  const envPath = path.resolve(".env");
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    if (k === key) return trimmed.slice(idx + 1).trim();
  }
  return "";
}

const token = readEnvValue("SUPABASE_ACCESS_TOKEN");
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing from .env");
  process.exit(1);
}

const query = fs.readFileSync(path.resolve(MIGRATION_FILE), "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query }),
});

const text = await res.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  payload = text;
}

if (!res.ok) {
  console.error("Migration failed:", res.status, JSON.stringify(payload, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      projectRef: PROJECT_REF,
      migration: MIGRATION_NAME,
      result: payload,
    },
    null,
    2
  )
);
