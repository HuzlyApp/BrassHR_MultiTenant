import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  changeApplicationStatus,
  getStatusBySystemKey,
} from "@/lib/jobs/application-statuses/service";
import { isTerminalApplicationStatus } from "@/lib/onboarding/workflow-phase";

export const ACCEPTED_OTHER_OFFER_FREEZE_NOTE =
  "Frozen: candidate accepted another offer and became a worker on a different job.";

export const ACCEPTED_OTHER_OFFER_FREEZE_ACTION = "application.frozen_after_offer_accept";

type FreezeResult = {
  frozenApplicationIds: string[];
  skippedApplicationIds: string[];
  errors: Array<{ applicationId: string; message: string }>;
};

/**
 * After a candidate accepts an offer / converts to worker, freeze every other
 * non-terminal application for that person so recruiters cannot keep hiring them
 * on parallel jobs (BUG-359).
 */
export async function freezeOtherApplicationsOnHire(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    workerId: string;
    acceptedApplicationId: string | null;
    actorUserId?: string | null;
    origin?: string | null;
  }
): Promise<FreezeResult> {
  const acceptedId = input.acceptedApplicationId?.trim() || null;
  if (!acceptedId) {
    return { frozenApplicationIds: [], skippedApplicationIds: [], errors: [] };
  }

  const { data, error } = await supabase
    .from("job_applications")
    .select("id, status")
    .eq("tenant_id", input.tenantId)
    .eq("worker_id", input.workerId);

  if (error) {
    console.error("[freeze-other-applications] list failed", error.message);
    return {
      frozenApplicationIds: [],
      skippedApplicationIds: [],
      errors: [{ applicationId: "*", message: error.message }],
    };
  }

  const others = (data ?? []).filter((row) => {
    const id = String(row.id ?? "");
    if (!id || id === acceptedId) return false;
    return !isTerminalApplicationStatus(row.status);
  });

  const frozenApplicationIds: string[] = [];
  const skippedApplicationIds: string[] = [];
  const errors: Array<{ applicationId: string; message: string }> = [];

  if (others.length === 0) {
    return { frozenApplicationIds, skippedApplicationIds, errors };
  }

  const frozenStatus = await getStatusBySystemKey(supabase, input.tenantId, "archived");
  if (!frozenStatus?.isActive) {
    return {
      frozenApplicationIds,
      skippedApplicationIds: others.map((row) => String(row.id)),
      errors: [{ applicationId: "*", message: 'Status "archived" (Position Closed) is not configured.' }],
    };
  }

  for (const row of others) {
    const applicationId = String(row.id);
    try {
      const result = await changeApplicationStatus(supabase, {
        tenantId: input.tenantId,
        applicationId,
        statusId: frozenStatus.id,
        changedByUserId: input.actorUserId ?? null,
        note: ACCEPTED_OTHER_OFFER_FREEZE_NOTE,
        origin: input.origin ?? null,
        changeSource: "SYSTEM",
      });
      if (result.unchanged) {
        skippedApplicationIds.push(applicationId);
      } else {
        frozenApplicationIds.push(applicationId);
      }
    } catch (freezeError) {
      const message =
        freezeError instanceof Error ? freezeError.message : "Could not freeze application";
      console.warn("[freeze-other-applications] failed", { applicationId, message });
      errors.push({ applicationId, message });
    }
  }

  if (frozenApplicationIds.length > 0) {
    await writeActivityLog({
      actorUserId: input.actorUserId ?? null,
      action: ACCEPTED_OTHER_OFFER_FREEZE_ACTION,
      entityType: "worker",
      entityId: input.workerId,
      tenantId: input.tenantId,
      metadata: {
        accepted_application_id: acceptedId,
        frozen_application_ids: frozenApplicationIds,
        note: ACCEPTED_OTHER_OFFER_FREEZE_NOTE,
      },
    });
  }

  return { frozenApplicationIds, skippedApplicationIds, errors };
}
