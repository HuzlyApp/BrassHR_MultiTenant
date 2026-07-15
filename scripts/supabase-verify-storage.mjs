#!/usr/bin/env node
/**
 * npm run supabase:verify-storage
 *
 * Compares Storage bucket definitions (names / public flag) prod → staging.
 * Does NOT copy Storage objects. Optionally checks allowlisted path prefixes exist as config only.
 */
import { createClient } from "@supabase/supabase-js";
import {
  STORAGE_OBJECT_SYNC_ALLOWLIST,
} from "./supabase-sync/config.mjs";
import {
  resolveDirectionFromEnv,
  writeSyncReport,
} from "./supabase-sync/common.mjs";

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function listBuckets(url, key) {
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.storage.listBuckets();
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((b) => ({
      id: b.id,
      name: b.name,
      public: Boolean(b.public),
      fileSizeLimit: b.file_size_limit ?? null,
      allowedMimeTypes: b.allowed_mime_types ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const { source, dest } = resolveDirectionFromEnv({ dryRun: true });

  const prodUrl =
    process.env.PRODUCTION_SUPABASE_URL?.trim() || `https://${source}.supabase.co`;
  const stagingUrl =
    process.env.STAGING_SUPABASE_URL?.trim() || `https://${dest}.supabase.co`;
  const prodKey = requireEnv("PRODUCTION_SERVICE_ROLE_KEY");
  const stagingKey =
    process.env.STAGING_SERVICE_ROLE_KEY?.trim() ||
    process.env.DEVELOPMENT_SERVICE_ROLE_KEY?.trim();
  if (!stagingKey) {
    throw new Error("STAGING_SERVICE_ROLE_KEY (or DEVELOPMENT_SERVICE_ROLE_KEY) is required");
  }

  const prodBuckets = await listBuckets(prodUrl, prodKey);
  const stagingBuckets = await listBuckets(stagingUrl, stagingKey);

  const prodNames = new Set(prodBuckets.map((b) => b.name));
  const stagingNames = new Set(stagingBuckets.map((b) => b.name));

  const missingOnStaging = [...prodNames].filter((n) => !stagingNames.has(n));
  const extraOnStaging = [...stagingNames].filter((n) => !prodNames.has(n));

  const mismatchedPublic = [];
  for (const pb of prodBuckets) {
    const sb = stagingBuckets.find((b) => b.name === pb.name);
    if (sb && sb.public !== pb.public) {
      mismatchedPublic.push({
        bucket: pb.name,
        productionPublic: pb.public,
        stagingPublic: sb.public,
      });
    }
  }

  const failed = [];
  if (missingOnStaging.length) failed.push("staging_missing_buckets");
  if (mismatchedPublic.length) failed.push("bucket_public_flag_mismatch");

  const report = {
    executionDate: new Date().toISOString(),
    sourceEnvironment: "production",
    destinationEnvironment: "staging",
    sourceRef: source,
    destinationRef: dest,
    productionBuckets: prodBuckets,
    stagingBuckets,
    missingOnStaging,
    extraOnStaging,
    mismatchedPublic,
    storageObjectAllowlist: STORAGE_OBJECT_SYNC_ALLOWLIST,
    note: "Bucket config only. Production Storage objects (resumes, IDs, agreements) are never copied.",
    failedValidations: failed,
    warnings: extraOnStaging.length
      ? ["Staging has buckets not present in production."]
      : [],
    manualActionsRequired: missingOnStaging.length
      ? [
          "Create missing buckets on staging (empty) with matching public/private settings and Storage RLS.",
        ]
      : [],
  };

  const path = writeSyncReport(report, "verify-storage-report.json");
  console.log(JSON.stringify(report, null, 2));
  console.error(`Report: ${path}`);
  process.exit(failed.length ? 2 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
