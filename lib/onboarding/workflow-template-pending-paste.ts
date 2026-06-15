const PENDING_PASTE_KEY = "brasshr-pending-workflow-paste";

export function markPendingWorkflowPaste(templateId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_PASTE_KEY, templateId);
}

export function isPendingWorkflowPaste(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(PENDING_PASTE_KEY));
}

export function clearPendingWorkflowPaste(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_PASTE_KEY);
}

export function readPendingWorkflowPasteTemplateId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PENDING_PASTE_KEY);
}
