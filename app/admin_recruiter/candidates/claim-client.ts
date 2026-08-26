import type { BulkClaimResponse } from "@/lib/candidates/claim";

export async function postClaimCandidates(candidateIds: string[]): Promise<BulkClaimResponse> {
  const response = await fetch("/api/admin/candidates/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds }),
  });
  const payload = (await response.json().catch(() => ({}))) as BulkClaimResponse & {
    error?: string;
  };
  if (!response.ok && !payload.results) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to claim candidates");
  }
  return payload;
}

export async function postClaimApplications(applicationIds: string[]): Promise<BulkClaimResponse> {
  const response = await fetch("/api/admin/job-applications/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationIds }),
  });
  const payload = (await response.json().catch(() => ({}))) as BulkClaimResponse & {
    error?: string;
  };
  if (!response.ok && !payload.results) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to claim candidates");
  }
  return payload;
}
