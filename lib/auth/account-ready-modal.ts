export const ACCOUNT_READY_MODAL_SEEN_KEY = "brasshr_account_ready_modal_seen";

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
