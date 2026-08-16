/**
 * Leave `/your-trial` for the public BrassHR landing (`/`).
 *
 * Keeps the owner signed in and keeps the 4h trial-prep cookie so the setup
 * email continuation link can open `/tenant-onboarding` directly.
 *
 * Middleware allows incomplete owners to stay on `/` (no bounce back to trial).
 */
export async function leaveOwnerTrialPreparation(): Promise<void> {
  window.location.href = "/";
}
