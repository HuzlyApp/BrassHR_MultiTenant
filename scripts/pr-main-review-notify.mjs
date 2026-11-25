#!/usr/bin/env node
/**
 * Email reviewers when a PR targets main.
 *
 * Required env:
 *   RESEND_API_KEY
 *   MIGRATION_NOTIFY_TO
 *   PR_NUMBER, PR_TITLE, PR_URL, PR_AUTHOR, PR_BASE, PR_HEAD, REPO
 *
 * Optional:
 *   MIGRATION_NOTIFY_FROM
 */

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

async function main() {
  const apiKey = env("RESEND_API_KEY");
  const toRaw = env("MIGRATION_NOTIFY_TO");
  if (!apiKey) {
    console.log("RESEND_API_KEY missing; review notify skipped");
    return;
  }
  if (!toRaw) {
    console.log("MIGRATION_NOTIFY_TO missing; review notify skipped");
    return;
  }

  const to = toRaw.split(",").map((item) => item.trim()).filter(Boolean);
  const from = env("MIGRATION_NOTIFY_FROM", "BrassHR Reviews <onboarding@resend.dev>");
  const number = env("PR_NUMBER", "?");
  const title = env("PR_TITLE", "(no title)");
  const url = env("PR_URL", "");
  const author = env("PR_AUTHOR", "unknown");
  const base = env("PR_BASE", "main");
  const head = env("PR_HEAD", "branch");
  const repo = env("REPO", "HuzlyApp/BrassHR_MultiTenant");

  const subject = `[Review needed] PR #${number} → ${base}: ${title}`;
  const text = [
    `A pull request is ready for review before merge into ${base} (production branch).`,
    "",
    `Repository: ${repo}`,
    `PR: #${number} — ${title}`,
    `Author: ${author}`,
    `Branch: ${head} → ${base}`,
    url ? `Open PR: ${url}` : null,
    "",
    "Please:",
    "1) Open the PR link",
    "2) Review the changes",
    "3) Click Approve on GitHub",
    "4) After approval, the ruleset can allow merge into main",
    "",
    "Note: Approving this PR merges code only. Production database migrations still require the separate Migrate Production Supabase Action + Environment approval.",
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
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Resend failed:", payload);
    process.exit(1);
  }

  console.log("PR review email sent:", payload.id || "ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
