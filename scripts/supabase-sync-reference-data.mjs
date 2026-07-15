#!/usr/bin/env node
/**
 * npm run supabase:sync-reference-data
 *
 * One-way upsert of allowlisted reference tables: prod → staging.
 * Dry-run by default.
 *
 *   node scripts/supabase-sync-reference-data.mjs
 *   node scripts/supabase-sync-reference-data.mjs --apply
 *   node scripts/supabase-sync-reference-data.mjs --apply --tables=skill_categories,faqs
 */
import { createClient } from "@supabase/supabase-js";
import {
  PROD_TO_STAGING_DATA_SYNC_ALLOWLIST,
  REPLACEABLE_REFERENCE_TABLES,
  SCHEMA_ONLY_TABLES,
  isSchemaOnlyTable,
} from "./supabase-sync/config.mjs";
import {
  resolveDirectionFromEnv,
  writeSyncReport,
} from "./supabase-sync/common.mjs";

const apply = process.argv.includes("--apply");
const tablesArg = process.argv.find((a) => a.startsWith("--tables="));
const requested = tablesArg
  ? tablesArg
      .slice("--tables=".length)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  : [...PROD_TO_STAGING_DATA_SYNC_ALLOWLIST];

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAll(sb, table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await sb.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const { source, dest } = resolveDirectionFromEnv({ dryRun: !apply });

  for (const table of requested) {
    if (!PROD_TO_STAGING_DATA_SYNC_ALLOWLIST.includes(table)) {
      throw new Error(
        `Refused: ${table} is not in PROD_TO_STAGING_DATA_SYNC_ALLOWLIST`
      );
    }
    if (isSchemaOnlyTable(table) || SCHEMA_ONLY_TABLES.includes(table)) {
      throw new Error(`Refused: ${table} is schema-only (no row sync).`);
    }
  }

  const prodUrl =
    process.env.PRODUCTION_SUPABASE_URL?.trim() ||
    `https://${source}.supabase.co`;
  const stagingUrl =
    process.env.STAGING_SUPABASE_URL?.trim() ||
    `https://${dest}.supabase.co`;
  const prodKey = requireEnv("PRODUCTION_SERVICE_ROLE_KEY");
  const stagingKey =
    process.env.STAGING_SERVICE_ROLE_KEY?.trim() ||
    process.env.DEVELOPMENT_SERVICE_ROLE_KEY?.trim();
  if (!stagingKey) {
    throw new Error("STAGING_SERVICE_ROLE_KEY (or DEVELOPMENT_SERVICE_ROLE_KEY) is required");
  }

  // Never accept accidental reverse URLs
  if (!prodUrl.includes(source) || !stagingUrl.includes(dest)) {
    throw new Error("URL/project ref mismatch — refusing unsafe sync.");
  }

  const prod = client(prodUrl, prodKey);
  const staging = client(stagingUrl, stagingKey);

  const results = [];
  for (const table of requested) {
    const rows = await fetchAll(prod, table);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (!apply) {
      results.push({
        table,
        mode: "dry-run",
        sourceRows: rows.length,
        inserted: 0,
        updated: 0,
        skipped: rows.length,
        replaceable: REPLACEABLE_REFERENCE_TABLES.includes(table),
      });
      continue;
    }

    if (!rows.length) {
      results.push({
        table,
        mode: "apply",
        sourceRows: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
      });
      continue;
    }

    // Upsert in chunks; rely on primary key
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error, count } = await staging.from(table).upsert(slice, {
        ignoreDuplicates: false,
        count: "exact",
      });
      if (error) throw new Error(`${table} upsert failed: ${error.message}`);
      inserted += slice.length;
      void count;
      void updated;
      void skipped;
    }

    results.push({
      table,
      mode: "apply",
      sourceRows: rows.length,
      upserted: rows.length,
      replaceable: REPLACEABLE_REFERENCE_TABLES.includes(table),
    });
  }

  const report = {
    executionDate: new Date().toISOString(),
    sourceEnvironment: "production",
    destinationEnvironment: "staging",
    sourceRef: source,
    destinationRef: dest,
    mode: apply ? "apply" : "dry-run",
    allowlist: PROD_TO_STAGING_DATA_SYNC_ALLOWLIST,
    tablesRequested: requested,
    referenceDataTablesSynchronized: results,
    warnings: apply
      ? []
      : ["Dry-run only. Pass --apply to upsert allowlisted reference data."],
    failedValidations: [],
    manualActionsRequired: [],
    note: "Category-2 allowlist only. No Auth users, Storage objects, or Category-1 PII tables.",
  };

  const path = writeSyncReport(report, "sync-reference-data-report.json");
  console.log(JSON.stringify(report, null, 2));
  console.error(`Report: ${path}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
