#!/usr/bin/env node
/**
 * Summarize Supabase migration SQL files for humans / email / CI logs.
 *
 * Usage:
 *   node scripts/summarize-migrations.mjs
 *   node scripts/summarize-migrations.mjs --files a.sql,b.sql
 *   node scripts/summarize-migrations.mjs --since 20261119000000
 *   node scripts/summarize-migrations.mjs --json
 */

import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const PATTERNS = [
  { key: "tables_created", re: /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."]+)/gi },
  { key: "tables_altered", re: /\balter\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_."]+)/gi },
  { key: "tables_dropped", re: /\bdrop\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_."]+)/gi },
  { key: "columns_added", re: /\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."]+)/gi },
  { key: "columns_dropped", re: /\bdrop\s+column\s+(?:if\s+exists\s+)?([a-zA-Z0-9_."]+)/gi },
  { key: "indexes", re: /\bcreate\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."]+)/gi },
  { key: "policies", re: /\bcreate\s+policy\s+("?[\w\s-]+"?)\s+on\s+([a-zA-Z0-9_."]+)/gi },
  { key: "functions", re: /\bcreate\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_."]+)/gi },
  { key: "triggers", re: /\bcreate\s+(?:or\s+replace\s+)?trigger\s+([a-zA-Z0-9_."]+)/gi },
  { key: "types", re: /\bcreate\s+type\s+([a-zA-Z0-9_."]+)/gi },
];

function parseArgs(argv) {
  const out = { files: null, since: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") out.json = true;
    else if (arg === "--files") out.files = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--since") out.since = String(argv[++i] || "").trim();
  }
  return out;
}

function listMigrationFiles({ files, since }) {
  if (files?.length) {
    return files.map((file) => (path.isAbsolute(file) ? file : path.join(MIGRATIONS_DIR, path.basename(file))));
  }
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => {
      if (!since) return true;
      const version = name.slice(0, 14);
      return version > since;
    })
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name));
}

function collectMatches(sql, re) {
  const found = new Set();
  for (const match of sql.matchAll(re)) {
    const value = (match[2] ? `${match[1]} on ${match[2]}` : match[1] || "").replace(/"/g, "").trim();
    if (value) found.add(value);
  }
  return [...found].sort();
}

function summarizeFile(filePath) {
  const name = path.basename(filePath);
  const version = name.slice(0, 14);
  const sql = fs.readFileSync(filePath, "utf8");
  const changes = {};
  for (const pattern of PATTERNS) {
    const items = collectMatches(sql, pattern.re);
    if (items.length) changes[pattern.key] = items;
  }
  return {
    file: name,
    version,
    bytes: Buffer.byteLength(sql, "utf8"),
    changes,
  };
}

function formatText(summaries) {
  if (summaries.length === 0) return "No migration files matched.";
  const lines = [`Migration summary (${summaries.length} file${summaries.length === 1 ? "" : "s"}):`, ""];
  for (const item of summaries) {
    lines.push(`• ${item.file}`);
    const keys = Object.keys(item.changes);
    if (keys.length === 0) {
      lines.push("  - (no CREATE/ALTER/DROP table/index/policy/function patterns detected)");
    } else {
      for (const key of keys) {
        lines.push(`  - ${key}: ${item.changes[key].join(", ")}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function main() {
  const args = parseArgs(process.argv);
  const files = listMigrationFiles(args);
  const summaries = files.filter((file) => fs.existsSync(file)).map(summarizeFile);
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ migrations: summaries }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatText(summaries)}\n`);
  }
}

main();
