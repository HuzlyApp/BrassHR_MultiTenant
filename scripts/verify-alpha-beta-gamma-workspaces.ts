/**
 * Live verification: create Alpha / Beta / Gamma tenants and one Firma workspace each.
 *
 * Mirrors signup: INSERT tenant → POST /workspaces → save firma_workspace_id on that tenant.
 * Safe to re-run (skips tenants that already have a live workspace).
 *
 *   npx tsx scripts/verify-alpha-beta-gamma-workspaces.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const DEFAULT_API_BASE = "https://api.firma.dev/functions/v1/signing-request-api";

const CASES = [
  { name: "Alpha", slug: "verify-alpha" },
  { name: "Beta", slug: "verify-beta" },
  { name: "Gamma", slug: "verify-gamma" },
] as const;

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function redact(text: string): string {
  return text.replace(/firma_(live|test)_[A-Za-z0-9_-]+/g, "firma_$1_[REDACTED]");
}

async function firmaFetch(path: string, init?: RequestInit) {
  const apiKey = process.env.FIRMA_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing FIRMA_API_KEY");
  const base = (process.env.FIRMA_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Firma ${init?.method ?? "GET"} ${path} (${response.status}): ${redact(bodyText)}`);
  }
  return bodyText ? (JSON.parse(bodyText) as unknown) : null;
}

type WorkspaceRow = { id?: string; name?: string };
type WorkspaceList = { results?: WorkspaceRow[]; pagination?: { total_pages?: number } };

async function listWorkspaceIds(): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 8) {
    const path = page === 1 ? "/workspaces" : `/workspaces?page=${page}`;
    const result = (await firmaFetch(path)) as WorkspaceList | WorkspaceRow[];
    const rows = Array.isArray(result) ? result : result.results ?? [];
    for (const row of rows) {
      const id = row.id?.trim();
      if (id) byId.set(id, row.name?.trim() || id);
    }
    if (!Array.isArray(result) && result.pagination?.total_pages) {
      totalPages = Math.max(1, Number(result.pagination.total_pages) || 1);
    } else {
      break;
    }
    page += 1;
  }
  return byId;
}

async function main() {
  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let live = await listWorkspaceIds();

  for (const c of CASES) {
    const { data: existing, error: loadErr } = await supabase
      .from("tenants")
      .select("id, name, slug, firma_workspace_id")
      .eq("slug", c.slug)
      .maybeSingle();
    if (loadErr) throw loadErr;

    let tenantId = existing?.id ? String(existing.id) : "";
    if (!tenantId) {
      const { data: created, error: insertErr } = await supabase
        .from("tenants")
        .insert({
          name: c.name,
          slug: c.slug,
          subdomain: c.slug,
          plan: "starter",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertErr || !created?.id) throw insertErr ?? new Error(`Failed to insert ${c.name}`);
      tenantId = String(created.id);
      console.log("[verify] tenant created", { tenantId, name: c.name, slug: c.slug });
    } else {
      console.log("[verify] tenant exists", { tenantId, name: c.name, slug: c.slug });
    }

    const stored =
      typeof existing?.firma_workspace_id === "string" ? existing.firma_workspace_id.trim() : "";
    if (stored && live.has(stored)) {
      console.log("[verify] already_configured", { tenantId, workspaceId: stored });
      continue;
    }

    const workspaceName = `BrassHR - ${c.name} (${c.slug})`;
    console.log("[verify] workspace insert attempted", { tenantId, workspaceName });
    const createdWs = (await firmaFetch("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: workspaceName }),
    })) as { id?: string; name?: string };
    const workspaceId = createdWs.id?.trim();
    if (!workspaceId) throw new Error(`Firma did not return a workspace id for ${c.name}`);

    live = await listWorkspaceIds();
    if (!live.has(workspaceId)) {
      throw new Error(`Created workspace ${workspaceId} is not visible on GET /workspaces`);
    }

    const { error: updateErr } = await supabase
      .from("tenants")
      .update({
        firma_workspace_id: workspaceId,
        firma_workspace_provisioning_status: "created",
        firma_workspace_provisioning_error: null,
        firma_workspace_provisioned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    if (updateErr) throw updateErr;
    console.log("[verify] workspace created", { tenantId, workspaceId });
  }

  const slugs = CASES.map((c) => c.slug);
  const { data: rows, error } = await supabase
    .from("tenants")
    .select("id, name, slug, firma_workspace_id")
    .in("slug", slugs);
  if (error) throw error;

  live = await listWorkspaceIds();
  const mapped = (rows ?? []).map((row) => {
    const workspaceId = String(row.firma_workspace_id ?? "");
    const workspaceName = live.get(workspaceId) ?? "(missing from Firma)";
    const ok = Boolean(workspaceId) && live.has(workspaceId);
    return {
      tenant: String(row.name),
      tenantId: String(row.id),
      workspaceId,
      workspaceName,
      result: ok ? "PASS" : "FAIL",
    };
  });

  const ids = mapped.map((row) => row.workspaceId);
  const unique = new Set(ids);
  console.log("\n=== Alpha / Beta / Gamma ===");
  console.table(mapped);
  console.log("distinct workspaces", unique.size, "of", ids.length);
  if (unique.size !== ids.length || mapped.some((row) => row.result !== "PASS")) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
