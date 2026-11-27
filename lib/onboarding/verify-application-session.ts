import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicationSessionCheck = {
  owned: boolean;
  workerId: string | null;
  ownerAuthUserId: string | null;
  ownerIsAnonymous: boolean | null;
  ownerEmail: string | null;
  canClaimWithJobToken: boolean;
};

function maskEmail(email: string | null): string | null {
  const value = email?.trim().toLowerCase() || "";
  if (!value || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Check whether the current auth user owns the job application, and whether a
 * reports that public job links never grant applicant ownership.
 */
export async function checkApplicationSessionOwnership(
  supabase: SupabaseClient,
  params: {
    applicationId: string;
    authUserId: string;
    tenantId?: string | null;
    jobToken?: string | null;
  }
): Promise<ApplicationSessionCheck | null> {
  const applicationId = params.applicationId.trim();
  const authUserId = params.authUserId.trim();
  if (!applicationId || !authUserId) return null;

  let appQuery = supabase
    .from("job_applications")
    .select("id, tenant_id, worker_id, applicant_auth_user_id, job_requisition_id, status")
    .eq("id", applicationId);
  if (params.tenantId?.trim()) {
    appQuery = appQuery.eq("tenant_id", params.tenantId.trim());
  }
  const { data: app, error: appError } = await appQuery.maybeSingle();
  if (appError) throw appError;
  if (!app?.id || !app.worker_id) return null;

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id, user_id, email, tenant_id")
    .eq("id", app.worker_id)
    .eq("tenant_id", app.tenant_id)
    .maybeSingle();
  if (workerError) throw workerError;
  if (!worker?.id) return null;

  const ownerAuthUserId =
    (typeof worker.user_id === "string" && worker.user_id.trim()) ||
    (typeof app.applicant_auth_user_id === "string" && app.applicant_auth_user_id.trim()) ||
    null;

  const owned =
    ownerAuthUserId === authUserId ||
    (typeof worker.user_id === "string" && worker.user_id === authUserId) ||
    (typeof app.applicant_auth_user_id === "string" &&
      app.applicant_auth_user_id === authUserId);

  let ownerIsAnonymous: boolean | null = null;
  if (ownerAuthUserId) {
    const { data: ownerAuth, error: ownerAuthError } = await supabase.auth.admin.getUserById(
      ownerAuthUserId
    );
    if (!ownerAuthError) {
      ownerIsAnonymous = Boolean(ownerAuth.user?.is_anonymous);
    }
  }

  // A public job link carries no evidence that the visitor owns an application.
  const canClaimWithJobToken = false;

  return {
    owned,
    workerId: String(worker.id),
    ownerAuthUserId,
    ownerIsAnonymous,
    ownerEmail: maskEmail(typeof worker.email === "string" ? worker.email : null),
    canClaimWithJobToken,
  };
}
