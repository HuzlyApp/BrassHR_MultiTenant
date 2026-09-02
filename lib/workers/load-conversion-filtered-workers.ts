import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerStatus } from "@/lib/workers/workers-status-types";
import { ACTIVE_CANDIDATE_PIPELINE_STATUSES } from "@/lib/workers/candidate-status-label";
import {
  isApprovedPendingConversion,
  shouldExcludeFromApprovedCandidates,
  shouldExcludeFromCandidateLists,
} from "@/lib/workers/candidate-conversion-filter";
import { statusOrFilter } from "@/lib/workers/workers-status-filter";

type StatusAttempt = { col: "status" | "worker_status"; extra: string };

function isMissingColumnErr(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "42703" || err.code === "42P01") return true;
  return typeof err.message === "string" && err.message.includes(" does not exist");
}

function normalizeWorkerRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const pipeline =
      typeof r.status === "string" ? r.status.trim().toLowerCase() : "";
    const legacy =
      typeof r.worker_status === "string" ? r.worker_status.trim().toLowerCase() : "";
    const resolved = pipeline || legacy || null;
    return { ...r, status: resolved };
  });
}

async function filterConversionBatch(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  args: {
    status: WorkerStatus | null;
    conversionFilter: string;
  }
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;

  const candidateIds = rows
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  const convertedIds = new Set<string>();
  const chunkSize = 100;

  for (let index = 0; index < candidateIds.length; index += chunkSize) {
    const chunk = candidateIds.slice(index, index + chunkSize);
    const { data: employmentRows, error: employmentErr } = await supabase
      .from("workers")
      .select("candidate_id")
      .in("candidate_id", chunk);

    if (employmentErr) {
      if (isMissingColumnErr(employmentErr)) return rows;
      throw employmentErr;
    }

    for (const row of (employmentRows as { candidate_id?: string }[] | null) ?? []) {
      const id = String(row.candidate_id ?? "").trim();
      if (id) convertedIds.add(id);
    }
  }

  return rows.filter((row) => {
    const rowStatus = typeof row.status === "string" ? row.status : null;
    const rowId = typeof row.id === "string" ? row.id : "";
    const hasEmployment = convertedIds.has(rowId);
    if (args.conversionFilter === "pending") {
      return isApprovedPendingConversion(rowStatus, hasEmployment);
    }
    if (args.status == null) {
      return !shouldExcludeFromCandidateLists(rowStatus, hasEmployment);
    }
    return !shouldExcludeFromApprovedCandidates(rowStatus, hasEmployment);
  });
}

/** Scan worker table in batches and apply conversion filtering for accurate totals. */
export async function loadConversionFilteredWorkers(
  supabase: SupabaseClient,
  args: {
    select: string;
    attempt: StatusAttempt;
    status: WorkerStatus | null;
    conversionFilter: string;
    applyTenant: <T extends { eq: (col: string, val: string) => T }>(query: T) => T;
    offset: number;
    limit: number;
    maxScanRows?: number;
  }
): Promise<{ rows: Record<string, unknown>[]; total: number; hasMore: boolean }> {
  const batchSize = 500;
  const maxScanRows = args.maxScanRows ?? 20_000;
  const allFiltered: Record<string, unknown>[] = [];
  let dbOffset = 0;

  while (dbOffset < maxScanRows) {
    let query = supabase.from("worker").select(args.select);
    query = args.applyTenant(query) as typeof query;
    if (args.status) {
      query = query.or(statusOrFilter(args.attempt.col, args.status)) as typeof query;
    } else if (args.attempt.col === "status") {
      const active = ACTIVE_CANDIDATE_PIPELINE_STATUSES.join(",");
      query = query.or(`status.in.(${active}),status.is.null`) as typeof query;
    }
    query = query.order("created_at", { ascending: false }) as typeof query;
    query = query.range(dbOffset, dbOffset + batchSize - 1) as typeof query;

    const { data, error } = await query;
    if (error) throw error;

    const batch = normalizeWorkerRows(data ?? []);
    if (batch.length === 0) break;

    const filtered = await filterConversionBatch(supabase, batch, {
      status: args.status,
      conversionFilter: args.conversionFilter,
    });
    allFiltered.push(...filtered);

    if (batch.length < batchSize) break;
    dbOffset += batchSize;
  }

  const total = allFiltered.length;
  const rows = allFiltered.slice(args.offset, args.offset + args.limit);
  return {
    rows,
    total,
    hasMore: args.offset + rows.length < total,
  };
}
