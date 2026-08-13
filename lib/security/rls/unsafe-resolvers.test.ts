import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

const SCAN_DIRS = ["app", "lib"];

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
  return files;
}

type Hit = { file: string; line: number; snippet: string };

function scanUnsafeWorkerLimit(): Hit[] {
  const hits: Hit[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      if (!/job|application|worker|match-analysis|interview|note|resume/i.test(rel)) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!/\.eq\(\s*["']worker_id["']/.test(line)) continue;
        const window = lines.slice(i, Math.min(lines.length, i + 12)).join("\n");
        const hasLimit1 = /\.limit\(\s*1\s*\)/.test(window);
        const hasSingle = /\.(maybeSingle|single)\(\s*\)/.test(window);
        const hasApplication = /application_id|job_application_id|applicationId|jobApplicationId/.test(
          window
        );
        if ((hasLimit1 || hasSingle) && !hasApplication) {
          hits.push({
            file: rel,
            line: i + 1,
            snippet: line.trim().slice(0, 160),
          });
        }
      }
    }
  }
  return hits;
}

describe("unsafe worker_id + limit(1) resolvers", () => {
  it("application-scoped recruiting reads prefer application_id over worker_id limit 1", () => {
    const resumeText = readFileSync(
      path.join(ROOT, "app/api/admin/job-applications/[id]/resume-text/route.ts"),
      "utf8"
    );
    expect(resumeText).toContain("job_application_id");
    expect(resumeText).toMatch(/pickResumeForApplication|job_application_id\.eq/);

    const workspace = readFileSync(
      path.join(ROOT, "lib/jobs/match-analysis/load-workspace.ts"),
      "utf8"
    );
    expect(workspace).toContain("job_application_id");
  });

  it("lists remaining worker_id limit(1) resolvers without application context for review", () => {
    const hits = scanUnsafeWorkerLimit();
    const recruitingHits = hits.filter(
      (hit) =>
        /lib\/jobs\/match-analysis\/|app\/api\/admin\/job-applications\//.test(hit.file) &&
        !hit.file.endsWith("extract-resume-text.ts")
    );
    expect(recruitingHits, JSON.stringify(recruitingHits, null, 2)).toEqual([]);
  });
});
