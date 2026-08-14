import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const CLIENT_MARKERS = ['"use client"', "'use client'"];

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".git" ||
      name === ".next" ||
      name === "coverage" ||
      name === "agent-transcripts"
    ) {
      continue;
    }
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function isSourceFile(file: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs)$/.test(file);
}

describe("service role secret exposure", () => {
  it("never puts the service role key on NEXT_PUBLIC_ / VITE_PUBLIC_ / EXPO_PUBLIC_", () => {
    const files = walk(ROOT).filter(isSourceFile);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (
        /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(text) ||
        /VITE_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(text) ||
        /EXPO_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(text)
      ) {
        hits.push(path.relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("never imports createServiceRoleClient from client components", () => {
    const files = walk(path.join(ROOT, "app")).filter((f) => /\.(ts|tsx)$/.test(f));
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const isClient = CLIENT_MARKERS.some((m) => text.includes(m));
      if (isClient && text.includes("createServiceRoleClient")) {
        hits.push(path.relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("browser supabase helpers use the anon key, not the service role", () => {
    const browser = readFileSync(path.join(ROOT, "lib/supabase-browser.ts"), "utf8");
    const applicant = readFileSync(path.join(ROOT, "lib/supabase-applicant-browser.ts"), "utf8");
    expect(browser).toContain("getSupabaseAnonKey");
    expect(browser).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(applicant).toContain("getSupabaseAnonKey");
    expect(applicant).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("createServiceRoleClient is marked server-only", () => {
    const text = readFileSync(path.join(ROOT, "lib/supabase/service-role.ts"), "utf8");
    expect(text).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(text).not.toMatch(/NEXT_PUBLIC_/);
  });
});
