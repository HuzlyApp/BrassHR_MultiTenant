"use client";

import {
  LAUNCH_PAD_STORAGE_KEY,
  LAUNCH_PAD_STEP_IDS,
  type LaunchPadStepId,
} from "./constants";

export type LaunchPadProgress = Record<LaunchPadStepId, boolean>;

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

export function readLaunchPadProgress(): LaunchPadProgress {
  const base = emptyLaunchPadProgress();
  if (typeof window === "undefined") return base;
  try {
    const raw = sessionStorage.getItem(LAUNCH_PAD_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<LaunchPadStepId, boolean>>;
    for (const id of LAUNCH_PAD_STEP_IDS) {
      if (typeof parsed[id] === "boolean") base[id] = parsed[id];
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function writeLaunchPadProgress(progress: LaunchPadProgress): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAUNCH_PAD_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function markLaunchPadStepComplete(
  stepId: LaunchPadStepId,
  completed = true
): LaunchPadProgress {
  const next = { ...readLaunchPadProgress(), [stepId]: completed };
  writeLaunchPadProgress(next);
  return next;
}

export function countCompletedSteps(progress: LaunchPadProgress): number {
  return LAUNCH_PAD_STEP_IDS.filter((id) => progress[id]).length;
}
