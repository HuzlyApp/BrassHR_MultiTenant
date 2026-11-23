#!/usr/bin/env node
/**
 * Email a migration apply notification via Resend.
 *
 * Required env:
 *   RESEND_API_KEY
 *   MIGRATION_NOTIFY_TO   (comma-separated emails)
 *
 * Optional env:
 *   MIGRATION_NOTIFY_FROM (default: BrassHR Migrations <onboarding@resend.dev>)
 *   MIGRATION_ENV         (staging|production)
 *   MIGRATION_STATUS      (success|failed|planned)
 *   MIGRATION_ACTOR
 *   MIGRATION_SHA
 *   MIGRATION_RUN_URL
 *   MIGRATION_SUMMARY     (prebuilt text) OR pass --files / --since
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function buildSummaryFromArgs(argv) {
  const script = path.join(__dirname, "summarize-migrations.mjs");
  const forwarded = argv.slice(2);
  const result = spawnSync(process.execPath, [script, ...forwarded], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to summarize migrations");
  }
  return (result.stdout || "").trim();
}

async function main() {
  const apiKey = env("RESEND_API_KEY");
  const toRaw = env("MIGRATION_NOTIFY_TO");
  if (!apiKey) {
    console.error("RESEND_API_KEY is required");
    process.exit(1);
  }
  if (!toRaw) {
    console.error("MIGRATION_NOTIFY_TO is required");
    process.exit(1);
  }

  const to = toRaw.split(",").map((item) => item.trim()).filter(Boolean);
  const from = env("MIGRATION_NOTIFY_FROM", "BrassHR Migrations <onboarding@resend.dev>");
  const environment = env("MIGRATION_ENV", "unknown");
  const status = env("MIGRATION_STATUS", "planned");
  const actor = env("MIGRATION_ACTOR", "unknown");
  const sha = env("MIGRATION_SHA", "");
  const runUrl = env("MIGRATION_RUN_URL", "");
  const summary = env("MIGRATION_SUMMARY") || buildSummaryFromArgs(process.argv);

  const subject = `[${environment.toUpperCase()}] Migration ${status}: BrassHR Supabase`;
  const body = [
    `Environment: ${environment}`,
    `Status: ${status}`,
    `Triggered by: ${actor}`,
    sha ? `Commit: ${sha}` : null,
    runUrl ? `GitHub run: ${runUrl}` : null,
    "",
    summary || "(no summary)",
    "",
    "This email was sent by the BrassHR migration GitHub Action.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: body,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Resend failed:", payload);
    process.exit(1);
  }

  console.log("Migration email sent:", payload.id || "ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
