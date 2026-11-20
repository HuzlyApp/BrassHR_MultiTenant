"use client";

import {
  LAUNCH_PAD_STORAGE_KEY,
  LAUNCH_PAD_STEP_IDS,
  type LaunchPadStepId,
} from "./constants";

export type LaunchPadProgress = Record<LaunchPadStepId, boolean>;

/** Fired after Launch Pad progress is written so the sidebar can hide when complete. */
export const LAUNCH_PAD_PROGRESS_EVENT = "braas-launch-pad-progress";

export function emptyLaunchPadProgress(): LaunchPadProgress {
  return {
    logo: false,
    branding: false,
    domain: false,
    preview: false,
    invite: false,
    organization: false,
  };
}

function progressStorageKey(tenantId: string): string {
  return `${LAUNCH_PAD_STORAGE_KEY}:${tenantId}`;
}

function readProgressFromStore(
  store: Storage | null | undefined,
  tenantId: string
): LaunchPadProgress | null {
  if (!store) return null;
  try {
    const raw = store.getItem(progressStorageKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<LaunchPadStepId, boolean>>;
    const base = emptyLaunchPadProgress();
    for (const id of LAUNCH_PAD_STEP_IDS) {
      if (typeof parsed[id] === "boolean") base[id] = parsed[id];
    }
    return base;
  } catch {
    return null;
  }
}

export function readLaunchPadProgress(tenantId: string): LaunchPadProgress {
  const base = emptyLaunchPadProgress();
  if (typeof window === "undefined" || !tenantId) return base;
  return (
    readProgressFromStore(window.localStorage, tenantId) ??
    readProgressFromStore(window.sessionStorage, tenantId) ??
    base
  );
}

export function writeLaunchPadProgress(tenantId: string, progress: LaunchPadProgress): void {
  if (typeof window === "undefined" || !tenantId) return;
  try {
    const payload = JSON.stringify(progress);
    const key = progressStorageKey(tenantId);
    window.localStorage.setItem(key, payload);
    window.sessionStorage.setItem(key, payload);
    window.dispatchEvent(new CustomEvent(LAUNCH_PAD_PROGRESS_EVENT, { detail: progress }));
  } catch {
    /* ignore */
  }
}

export function markLaunchPadStepComplete(
  tenantId: string,
  stepId: LaunchPadStepId,
  completed = true
): LaunchPadProgress {
  const next = { ...readLaunchPadProgress(tenantId), [stepId]: completed };
  writeLaunchPadProgress(tenantId, next);
  return next;
}

export function countCompletedSteps(progress: LaunchPadProgress): number {
  return LAUNCH_PAD_STEP_IDS.filter((id) => progress[id]).length;
}

export function isLaunchPadFullyComplete(tenantId?: string): boolean {
  if (!tenantId) return false;
  const value = readLaunchPadProgress(tenantId);
  return LAUNCH_PAD_STEP_IDS.every((id) => value[id]);
}
