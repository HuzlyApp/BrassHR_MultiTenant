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

function readProgressFromStore(store: Storage | null | undefined): LaunchPadProgress | null {
  if (!store) return null;
  try {
    const raw = store.getItem(LAUNCH_PAD_STORAGE_KEY);
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

export function readLaunchPadProgress(): LaunchPadProgress {
  if (typeof window === "undefined") return emptyLaunchPadProgress();
  return (
    readProgressFromStore(window.localStorage) ??
    readProgressFromStore(window.sessionStorage) ??
    emptyLaunchPadProgress()
  );
}

export function writeLaunchPadProgress(progress: LaunchPadProgress): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify(progress);
    window.localStorage.setItem(LAUNCH_PAD_STORAGE_KEY, payload);
    // Keep session copy in sync for any mid-session readers.
    window.sessionStorage.setItem(LAUNCH_PAD_STORAGE_KEY, payload);
    window.dispatchEvent(
      new CustomEvent(LAUNCH_PAD_PROGRESS_EVENT, { detail: progress })
    );
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

export function isLaunchPadFullyComplete(progress?: LaunchPadProgress): boolean {
  const value = progress ?? readLaunchPadProgress();
  return LAUNCH_PAD_STEP_IDS.every((id) => value[id]);
}
