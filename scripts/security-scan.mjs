#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "agent-transcripts",
]);
const EXCLUDED_FILES = new Set(["package-lock.json", "performance-results.json"]);
const SECRET_PATTERNS = [
  { name: "Supabase service role JWT", regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: "OpenAI style API key", regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |OPENSSH |EC |)PRIVATE KEY-----/g },
  { name: "Hardcoded assignment secret", regex: /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{16,}["']/gi },
];
const PLACEHOLDER_VALUES = new Set([
  "your-secure-password",
  "your-secret",
  "your-token",
  "your-api-key",
]);

function shouldSkip(filePath) {
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.some((part) => EXCLUDED_DIRS.has(part))) return true;
  if (EXCLUDED_FILES.has(path.basename(filePath))) return true;
  if (/\.env(?:\.|$)/.test(path.basename(filePath))) return true;
  if (!/\.(ts|tsx|js|jsx|mjs|json|md|sql|toml|yml|yaml)$/.test(filePath)) return true;
  return false;
}

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) await walk(full, files);
    } else if (!shouldSkip(full)) {
      files.push(full);
    }
  }
  return files;
}

const findings = [];
for (const file of await walk(ROOT)) {
  const text = await readFile(file, "utf8").catch(() => "");
  for (const pattern of SECRET_PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const matched = match[0].toLowerCase();
      if ([...PLACEHOLDER_VALUES].some((placeholder) => matched.includes(placeholder))) {
        continue;
      }
      const before = text.slice(0, match.index ?? 0);
      const line = before.split(/\r?\n/).length;
      findings.push({
        file: path.relative(ROOT, file),
        line,
        type: pattern.name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found. Values are redacted:");
  for (const finding of findings) {
    console.error(`- ${finding.type} at ${finding.file}:${finding.line}`);
  }
  process.exitCode = 1;
} else {
  console.log("No high-confidence hardcoded secrets found in scanned source files.");
}
