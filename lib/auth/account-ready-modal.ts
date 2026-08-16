export const ACCOUNT_READY_MODAL_SEEN_KEY = "brasshr_account_ready_modal_seen";
export const ACCOUNT_READY_MODAL_PENDING_KEY = "brasshr_account_ready_modal_pending";

export function shouldShowAccountReadyModal(
  accountReadyFromUrl: boolean,
  modalSeen: boolean
): boolean {
  return accountReadyFromUrl && !modalSeen;
}

/** Remove `account-ready` from a your-trial search string. */
export function stripAccountReadySearchParam(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("account-ready");
  return params.toString();
}

export function buildYourTrialPath(search = ""): string {
  const query = stripAccountReadySearchParam(search);
  return query ? `/your-trial?${query}` : "/your-trial";
}

export function readAccountReadyModalSeen(
  storage: Pick<Storage, "getItem">
): boolean {
  try {
    return storage.getItem(ACCOUNT_READY_MODAL_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markAccountReadyModalSeen(storage: Pick<Storage, "setItem">): void {
  try {
    storage.setItem(ACCOUNT_READY_MODAL_SEEN_KEY, "true");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAccountReadyModalSeen(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(ACCOUNT_READY_MODAL_SEEN_KEY);
  } catch {
    /* ignore */
  }
}

export function readAccountReadyModalPending(
  storage: Pick<Storage, "getItem">
): boolean {
  try {
    return storage.getItem(ACCOUNT_READY_MODAL_PENDING_KEY) === "true";
  } catch {
    return false;
  }
}

/** Call right before redirecting from signup → /your-trial so the ready modal can open once. */
export function markAccountReadyModalPending(
  storage: Pick<Storage, "setItem" | "removeItem">
): void {
  try {
    storage.removeItem(ACCOUNT_READY_MODAL_SEEN_KEY);
    storage.setItem(ACCOUNT_READY_MODAL_PENDING_KEY, "true");
  } catch {
    /* ignore */
  }
}

export function clearAccountReadyModalPending(
  storage: Pick<Storage, "removeItem">
): void {
  try {
    storage.removeItem(ACCOUNT_READY_MODAL_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
