/**
 * Pre-Hire workflow stage ↔ status GROUP assignments.
 * One group can be available on many stages (one-to-many).
 * Closed is shared on every stage and is not stored as a per-stage assignment.
 * Assigning a group never changes status system keys or auto-moves candidates.
 */

import { PRE_HIRE_FIGMA_STAGES } from "@/lib/onboarding/hire-stage-groups";
import {
  APPLICATION_STATUS_GROUP_KEYS,
  isSharedClosedGroupKey,
  type ApplicationStatusGroupKey,
} from "./groups";

export const PRE_HIRE_STATUS_STAGE_NAMES = PRE_HIRE_FIGMA_STAGES;

export type PreHireStatusStageName = (typeof PRE_HIRE_STATUS_STAGE_NAMES)[number];

export type ApplicationStatusGroupStageAssignmentRecord = {
  id: string;
  tenantId: string;
  stageName: PreHireStatusStageName;
  groupId: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Default stages for each catalog group (Closed is shared, not listed). */
export const DEFAULT_GROUP_PRE_HIRE_STAGES: Record<
  Exclude<ApplicationStatusGroupKey, "closed">,
  PreHireStatusStageName[]
> = {
  start: ["Intake"],
  interview: ["Screening", "Interview"],
  msp: ["Submission"],
  client: ["Submission", "Approvals"],
  hire: ["Offer & Agreement", "Approvals"],
};

export function isPreHireStatusStageName(value: string): value is PreHireStatusStageName {
  return (PRE_HIRE_STATUS_STAGE_NAMES as readonly string[]).includes(value);
}

export function isAssignableCatalogGroupKey(
  systemKey: string | null | undefined
): systemKey is Exclude<ApplicationStatusGroupKey, "closed"> {
  const key = (systemKey ?? "").trim().toLowerCase();
  return (
    (APPLICATION_STATUS_GROUP_KEYS as readonly string[]).includes(key) &&
    !isSharedClosedGroupKey(key)
  );
}

/** @deprecated Prefer group-stage assignments. Kept for older status-stage helpers. */
export type ApplicationStatusStageAssignmentRecord = {
  id: string;
  tenantId: string;
  stageName: PreHireStatusStageName;
  statusId: string;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};
