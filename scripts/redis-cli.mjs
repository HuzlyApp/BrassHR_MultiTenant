/**
 * Open redis-cli using REDIS_URL from .env
 *
 * Usage:
 *   npm run redis:cli
 *   npm run redis:cli -- PING
 *   npm run redis:cli -- KEYS "supabase:*"
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
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

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error("REDIS_URL is not set in .env");
  process.exit(1);
}

const args = ["-u", url, ...process.argv.slice(2)];
const result = spawnSync("redis-cli", args, { stdio: "inherit", shell: process.platform === "win32" });

if (result.error?.code === "ENOENT") {
  console.error("redis-cli not found. Install Redis CLI or use WSL.");
  console.error("");
  console.error("Direct command (from .env REDIS_URL):");
  console.error(`  redis-cli -u "${url}"`);
  process.exit(1);
}

process.exit(result.status ?? 1);
