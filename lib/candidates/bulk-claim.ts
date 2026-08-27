import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  BULK_CLAIM_SOURCE,
  buildClaimSummary,
  emptyClaimBuckets,
  pushClaimOutcome,
  type BulkClaimResponse,
  type ClaimOutcome,
  type ClaimResultItem,
} from "@/lib/candidates/claim";

type RpcWorkerRow = {
  candidate_id: string;
  outcome: string;
  previous_owner: string | null;
};

type RpcApplicationRow = {
  application_id: string;
  outcome: string;
  previous_owner: string | null;
  worker_id: string | null;
};

function mapOutcome(raw: string | null | undefined): ClaimOutcome {
  const value = String(raw ?? "").trim().toLowerCase();
  if (
    value === "claimed" ||
    value === "already_claimed" ||
    value === "not_found" ||
    value === "unauthorized" ||
    value === "ineligible" ||
    value === "failed"
  ) {
    return value;
  }
  return "failed";
}

async function resolveRecruiterName(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "You";
  const full =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
    (typeof data.email === "string" ? data.email.trim() : "");
  return full || "You";
}

async function writeClaimAudits(input: {
  supabase: SupabaseClient;
  tenantId: string;
  actorUserId: string | null;
  recruiterUserId: string;
  operationId: string;
  entityType: "worker" | "job_application";
  claimed: ClaimResultItem[];
  request?: Request;
}) {
  const rows = input.claimed.map((item) => ({
    tenant_id: input.tenantId,
    recruiter_user_id: input.recruiterUserId,
    candidate_id:
      input.entityType === "worker" ? item.id : item.workerId ?? null,
    job_id: null,
    analysis_id: null,
    note_id: null,
    activity_type: BULK_CLAIM_SOURCE,
    action_label: "Claimed candidate",
    previous_value: item.previousOwnerUserId ?? null,
    new_value: input.recruiterUserId,
    metadata: {
      source: BULK_CLAIM_SOURCE,
      operationId: input.operationId,
      entityType: input.entityType,
      entityId: item.id,
      previousOwnerUserId: item.previousOwnerUserId ?? null,
      newOwnerUserId: input.recruiterUserId,
    },
    source: "api",
    request_id: `${input.operationId}:${item.id}`,
  }));

  if (rows.length > 0) {
    const { error } = await input.supabase.from("recruiter_activity_logs").insert(rows);
    if (error) {
      console.error("[bulk-claim] recruiter_activity_logs insert failed:", error.message);
    }
  }

  for (const item of input.claimed) {
    void writeActivityLog({
      actorUserId: input.actorUserId,
      action: BULK_CLAIM_SOURCE,
      entityType: input.entityType,
      entityId: item.id,
      tenantId: input.tenantId,
      request: input.request,
      metadata: {
        source: BULK_CLAIM_SOURCE,
        operationId: input.operationId,
        previousOwnerUserId: item.previousOwnerUserId ?? null,
        newOwnerUserId: input.recruiterUserId,
        workerId: item.workerId ?? null,
      },
    });
  }
}

export async function bulkClaimWorkers(input: {
  supabase: SupabaseClient;
  tenantId: string;
  recruiterUserId: string;
  actorUserId: string | null;
  candidateIds: string[];
  operationId: string;
  request?: Request;
}): Promise<BulkClaimResponse> {
  const buckets = emptyClaimBuckets();
  const results: ClaimResultItem[] = [];
  const recruiterName = await resolveRecruiterName(input.supabase, input.recruiterUserId);

  const { data, error } = await input.supabase.rpc("claim_worker_candidates", {
    p_tenant_id: input.tenantId,
    p_candidate_ids: input.candidateIds,
    p_recruiter_user_id: input.recruiterUserId,
  });

  if (error) {
    // Fallback for environments where the RPC migration is not applied yet.
    return bulkClaimWorkersFallback({ ...input, recruiterName, buckets, results, rpcError: error.message });
  }

  const claimedItems: ClaimResultItem[] = [];
  for (const row of (data as RpcWorkerRow[] | null) ?? []) {
    const id = String(row.candidate_id);
    const outcome = mapOutcome(row.outcome);
    const item: ClaimResultItem = {
      id,
      outcome,
      previousOwnerUserId: row.previous_owner,
      workerId: id,
    };
    results.push(item);
    pushClaimOutcome(buckets, id, outcome);
    if (outcome === "claimed") claimedItems.push(item);
  }

  // Any submitted IDs missing from RPC response are treated as failed.
  const seen = new Set(results.map((r) => r.id));
  for (const id of input.candidateIds) {
    if (seen.has(id)) continue;
    results.push({ id, outcome: "failed" });
    pushClaimOutcome(buckets, id, "failed");
  }

  await writeClaimAudits({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    recruiterUserId: input.recruiterUserId,
    operationId: input.operationId,
    entityType: "worker",
    claimed: claimedItems,
    request: input.request,
  });

  return {
    ok: buckets.claimed.length > 0 || buckets.already_claimed.length === input.candidateIds.length,
    operationId: input.operationId,
    ...buckets,
    results,
    recruiter: { id: input.recruiterUserId, name: recruiterName },
    summary: buildClaimSummary({
      claimed: buckets.claimed.length,
      already_claimed: buckets.already_claimed.length,
      not_found: buckets.not_found.length,
      unauthorized: buckets.unauthorized.length,
      ineligible: buckets.ineligible.length,
      failed: buckets.failed.length,
    }),
  };
}

async function bulkClaimWorkersFallback(input: {
  supabase: SupabaseClient;
  tenantId: string;
  recruiterUserId: string;
  actorUserId: string | null;
  candidateIds: string[];
  operationId: string;
  request?: Request;
  recruiterName: string;
  buckets: ReturnType<typeof emptyClaimBuckets>;
  results: ClaimResultItem[];
  rpcError: string;
}): Promise<BulkClaimResponse> {
  console.warn("[bulk-claim] RPC unavailable, using fallback:", input.rpcError);

  const { data: rows, error } = await input.supabase
    .from("worker")
    .select("id, tenant_id, status, assigned_recruiter_user_id")
    .eq("tenant_id", input.tenantId)
    .in("id", input.candidateIds);

  if (error) {
    for (const id of input.candidateIds) {
      input.results.push({ id, outcome: "failed" });
      pushClaimOutcome(input.buckets, id, "failed");
    }
    return {
      ok: false,
      operationId: input.operationId,
      ...input.buckets,
      results: input.results,
      recruiter: { id: input.recruiterUserId, name: input.recruiterName },
      summary: buildClaimSummary({
        claimed: 0,
        already_claimed: 0,
        not_found: 0,
        unauthorized: 0,
        ineligible: 0,
        failed: input.candidateIds.length,
      }),
    };
  }

  const byId = new Map(
    ((rows as Array<{
      id: string;
      status?: string | null;
      assigned_recruiter_user_id?: string | null;
    }> | null) ?? []).map((row) => [String(row.id), row])
  );

  const claimedItems: ClaimResultItem[] = [];

  for (const id of input.candidateIds) {
    const row = byId.get(id);
    if (!row) {
      input.results.push({ id, outcome: "not_found" });
      pushClaimOutcome(input.buckets, id, "not_found");
      continue;
    }
    const owner = row.assigned_recruiter_user_id ?? null;
    const status = String(row.status ?? "").toLowerCase();
    if (["inactive", "cancelled", "banned", "suspended", "archived"].includes(status)) {
      input.results.push({ id, outcome: "ineligible", previousOwnerUserId: owner });
      pushClaimOutcome(input.buckets, id, "ineligible");
      continue;
    }
    if (owner) {
      input.results.push({ id, outcome: "already_claimed", previousOwnerUserId: owner });
      pushClaimOutcome(input.buckets, id, "already_claimed");
      continue;
    }

    const { data: updated, error: updateError } = await input.supabase
      .from("worker")
      .update({
        assigned_recruiter_user_id: input.recruiterUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", input.tenantId)
      .is("assigned_recruiter_user_id", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      input.results.push({ id, outcome: "failed" });
      pushClaimOutcome(input.buckets, id, "failed");
      continue;
    }
    if (!updated) {
      input.results.push({ id, outcome: "already_claimed" });
      pushClaimOutcome(input.buckets, id, "already_claimed");
      continue;
    }

    const item: ClaimResultItem = { id, outcome: "claimed", previousOwnerUserId: null, workerId: id };
    input.results.push(item);
    pushClaimOutcome(input.buckets, id, "claimed");
    claimedItems.push(item);
  }

  await writeClaimAudits({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    recruiterUserId: input.recruiterUserId,
    operationId: input.operationId,
    entityType: "worker",
    claimed: claimedItems,
    request: input.request,
  });

  return {
    ok: input.buckets.claimed.length > 0,
    operationId: input.operationId,
    ...input.buckets,
    results: input.results,
    recruiter: { id: input.recruiterUserId, name: input.recruiterName },
    summary: buildClaimSummary({
      claimed: input.buckets.claimed.length,
      already_claimed: input.buckets.already_claimed.length,
      not_found: input.buckets.not_found.length,
      unauthorized: input.buckets.unauthorized.length,
      ineligible: input.buckets.ineligible.length,
      failed: input.buckets.failed.length,
    }),
  };
}

export async function bulkClaimJobApplications(input: {
  supabase: SupabaseClient;
  tenantId: string;
  recruiterUserId: string;
  actorUserId: string | null;
  applicationIds: string[];
  operationId: string;
  request?: Request;
}): Promise<BulkClaimResponse> {
  const buckets = emptyClaimBuckets();
  const results: ClaimResultItem[] = [];
  const recruiterName = await resolveRecruiterName(input.supabase, input.recruiterUserId);

  const { data, error } = await input.supabase.rpc("claim_job_applications", {
    p_tenant_id: input.tenantId,
    p_application_ids: input.applicationIds,
    p_recruiter_user_id: input.recruiterUserId,
  });

  if (error) {
    return bulkClaimApplicationsFallback({
      ...input,
      recruiterName,
      buckets,
      results,
      rpcError: error.message,
    });
  }

  const claimedItems: ClaimResultItem[] = [];
  for (const row of (data as RpcApplicationRow[] | null) ?? []) {
    const id = String(row.application_id);
    const outcome = mapOutcome(row.outcome);
    const item: ClaimResultItem = {
      id,
      outcome,
      previousOwnerUserId: row.previous_owner,
      workerId: row.worker_id,
    };
    results.push(item);
    pushClaimOutcome(buckets, id, outcome);
    if (outcome === "claimed") claimedItems.push(item);
  }

  const seen = new Set(results.map((r) => r.id));
  for (const id of input.applicationIds) {
    if (seen.has(id)) continue;
    results.push({ id, outcome: "failed" });
    pushClaimOutcome(buckets, id, "failed");
  }

  await writeClaimAudits({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    recruiterUserId: input.recruiterUserId,
    operationId: input.operationId,
    entityType: "job_application",
    claimed: claimedItems,
    request: input.request,
  });

  return {
    ok: buckets.claimed.length > 0 || buckets.already_claimed.length === input.applicationIds.length,
    operationId: input.operationId,
    ...buckets,
    results,
    recruiter: { id: input.recruiterUserId, name: recruiterName },
    summary: buildClaimSummary({
      claimed: buckets.claimed.length,
      already_claimed: buckets.already_claimed.length,
      not_found: buckets.not_found.length,
      unauthorized: buckets.unauthorized.length,
      ineligible: buckets.ineligible.length,
      failed: buckets.failed.length,
    }),
  };
}

async function bulkClaimApplicationsFallback(input: {
  supabase: SupabaseClient;
  tenantId: string;
  recruiterUserId: string;
  actorUserId: string | null;
  applicationIds: string[];
  operationId: string;
  request?: Request;
  recruiterName: string;
  buckets: ReturnType<typeof emptyClaimBuckets>;
  results: ClaimResultItem[];
  rpcError: string;
}): Promise<BulkClaimResponse> {
  console.warn("[bulk-claim] applications RPC unavailable, using fallback:", input.rpcError);

  const { data: rows, error } = await input.supabase
    .from("job_applications")
    .select("id, tenant_id, status, assigned_recruiter_user_id, worker_id")
    .eq("tenant_id", input.tenantId)
    .in("id", input.applicationIds);

  if (error) {
    for (const id of input.applicationIds) {
      input.results.push({ id, outcome: "failed" });
      pushClaimOutcome(input.buckets, id, "failed");
    }
    return {
      ok: false,
      operationId: input.operationId,
      ...input.buckets,
      results: input.results,
      recruiter: { id: input.recruiterUserId, name: input.recruiterName },
      summary: buildClaimSummary({
        claimed: 0,
        already_claimed: 0,
        not_found: 0,
        unauthorized: 0,
        ineligible: 0,
        failed: input.applicationIds.length,
      }),
    };
  }

  const byId = new Map(
    ((rows as Array<{
      id: string;
      status?: string | null;
      assigned_recruiter_user_id?: string | null;
      worker_id?: string | null;
    }> | null) ?? []).map((row) => [String(row.id), row])
  );

  const claimedItems: ClaimResultItem[] = [];

  for (const id of input.applicationIds) {
    const row = byId.get(id);
    if (!row) {
      input.results.push({ id, outcome: "not_found" });
      pushClaimOutcome(input.buckets, id, "not_found");
      continue;
    }
    const owner = row.assigned_recruiter_user_id ?? null;
    const status = String(row.status ?? "").toLowerCase();
    if (["archived", "withdrawn", "rejected"].includes(status)) {
      input.results.push({
        id,
        outcome: "ineligible",
        previousOwnerUserId: owner,
        workerId: row.worker_id ?? null,
      });
      pushClaimOutcome(input.buckets, id, "ineligible");
      continue;
    }
    if (owner) {
      input.results.push({
        id,
        outcome: "already_claimed",
        previousOwnerUserId: owner,
        workerId: row.worker_id ?? null,
      });
      pushClaimOutcome(input.buckets, id, "already_claimed");
      continue;
    }

    const { data: updated, error: updateError } = await input.supabase
      .from("job_applications")
      .update({
        assigned_recruiter_user_id: input.recruiterUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", input.tenantId)
      .is("assigned_recruiter_user_id", null)
      .select("id, worker_id")
      .maybeSingle();

    if (updateError) {
      input.results.push({ id, outcome: "failed", workerId: row.worker_id ?? null });
      pushClaimOutcome(input.buckets, id, "failed");
      continue;
    }
    if (!updated) {
      input.results.push({ id, outcome: "already_claimed", workerId: row.worker_id ?? null });
      pushClaimOutcome(input.buckets, id, "already_claimed");
      continue;
    }

    const workerId =
      typeof updated.worker_id === "string" ? updated.worker_id : row.worker_id ?? null;
    if (workerId) {
      await input.supabase
        .from("worker")
        .update({
          assigned_recruiter_user_id: input.recruiterUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workerId)
        .eq("tenant_id", input.tenantId)
        .is("assigned_recruiter_user_id", null);
    }

    const item: ClaimResultItem = {
      id,
      outcome: "claimed",
      previousOwnerUserId: null,
      workerId,
    };
    input.results.push(item);
    pushClaimOutcome(input.buckets, id, "claimed");
    claimedItems.push(item);
  }

  await writeClaimAudits({
    supabase: input.supabase,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    recruiterUserId: input.recruiterUserId,
    operationId: input.operationId,
    entityType: "job_application",
    claimed: claimedItems,
    request: input.request,
  });

  return {
    ok: input.buckets.claimed.length > 0,
    operationId: input.operationId,
    ...input.buckets,
    results: input.results,
    recruiter: { id: input.recruiterUserId, name: input.recruiterName },
    summary: buildClaimSummary({
      claimed: input.buckets.claimed.length,
      already_claimed: input.buckets.already_claimed.length,
      not_found: input.buckets.not_found.length,
      unauthorized: input.buckets.unauthorized.length,
      ineligible: input.buckets.ineligible.length,
      failed: input.buckets.failed.length,
    }),
  };
}
