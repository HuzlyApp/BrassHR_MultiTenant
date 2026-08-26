export const BULK_CLAIM_MAX_IDS = 100;
export const BULK_CLAIM_SOURCE = "candidate_bulk_claim" as const;

export type ClaimOutcome =
  | "claimed"
  | "already_claimed"
  | "not_found"
  | "unauthorized"
  | "ineligible"
  | "failed";

export type ClaimResultItem = {
  id: string;
  outcome: ClaimOutcome;
  previousOwnerUserId?: string | null;
  workerId?: string | null;
};

export type BulkClaimResponse = {
  ok: boolean;
  operationId: string;
  claimed: string[];
  already_claimed: string[];
  not_found: string[];
  unauthorized: string[];
  ineligible: string[];
  failed: string[];
  results: ClaimResultItem[];
  recruiter: { id: string; name: string };
  summary: string;
};

const INELIGIBLE_WORKER_STATUSES = new Set([
  "inactive",
  "cancelled",
  "banned",
  "suspended",
  "archived",
]);

const INELIGIBLE_APPLICATION_STATUSES = new Set(["archived", "withdrawn", "rejected"]);

export function normalizeUuidList(ids: unknown, max = BULK_CLAIM_MAX_IDS): string[] {
  if (!Array.isArray(ids)) return [];
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!uuidRe.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function isWorkerClaimEligible(input: {
  assignedRecruiterUserId?: string | null;
  status?: string | null;
  currentUserId: string;
}): { eligible: boolean; reason: string | null } {
  const status = String(input.status ?? "").trim().toLowerCase();
  if (status && INELIGIBLE_WORKER_STATUSES.has(status)) {
    return { eligible: false, reason: "This candidate is inactive or archived." };
  }
  const owner = input.assignedRecruiterUserId?.trim() || null;
  if (!owner) return { eligible: true, reason: null };
  if (owner === input.currentUserId) {
    return { eligible: false, reason: "Already claimed by you." };
  }
  return { eligible: false, reason: "Already claimed by another recruiter." };
}

export function isApplicationClaimEligible(input: {
  assignedRecruiterUserId?: string | null;
  status?: string | null;
  currentUserId: string;
}): { eligible: boolean; reason: string | null } {
  const status = String(input.status ?? "").trim().toLowerCase();
  if (status && INELIGIBLE_APPLICATION_STATUSES.has(status)) {
    return { eligible: false, reason: "This application cannot be claimed." };
  }
  const owner = input.assignedRecruiterUserId?.trim() || null;
  if (!owner) return { eligible: true, reason: null };
  if (owner === input.currentUserId) {
    return { eligible: false, reason: "Already claimed by you." };
  }
  return { eligible: false, reason: "Already claimed by another recruiter." };
}

export function buildClaimSummary(parts: {
  claimed: number;
  already_claimed: number;
  not_found: number;
  unauthorized: number;
  ineligible: number;
  failed: number;
}): string {
  const messages: string[] = [];
  if (parts.claimed > 0) {
    messages.push(
      `${parts.claimed} candidate${parts.claimed === 1 ? "" : "s"} claimed successfully`
    );
  }
  if (parts.already_claimed > 0) {
    messages.push(
      `${parts.already_claimed} skipped because ${
        parts.already_claimed === 1 ? "it was" : "they were"
      } already claimed`
    );
  }
  if (parts.ineligible > 0) {
    messages.push(
      `${parts.ineligible} ineligible and skipped`
    );
  }
  if (parts.not_found > 0) {
    messages.push(`${parts.not_found} not found`);
  }
  if (parts.unauthorized > 0) {
    messages.push(`${parts.unauthorized} unauthorized`);
  }
  if (parts.failed > 0) {
    messages.push(`${parts.failed} failed`);
  }
  if (messages.length === 0) return "No candidates were claimed.";
  if (messages.length === 1) return `${messages[0]}.`;
  const last = messages.pop()!;
  return `${messages.join(". ")}. ${last.charAt(0).toUpperCase()}${last.slice(1)}.`;
}

export function emptyClaimBuckets(): Omit<
  BulkClaimResponse,
  "ok" | "operationId" | "results" | "recruiter" | "summary"
> {
  return {
    claimed: [],
    already_claimed: [],
    not_found: [],
    unauthorized: [],
    ineligible: [],
    failed: [],
  };
}

export function pushClaimOutcome(
  buckets: ReturnType<typeof emptyClaimBuckets>,
  id: string,
  outcome: ClaimOutcome
) {
  buckets[outcome].push(id);
}
