import { describe, expect, it } from "vitest";
import {
  ACCOUNT_READY_MODAL_PENDING_KEY,
  ACCOUNT_READY_MODAL_SEEN_KEY,
  buildYourTrialPath,
  clearAccountReadyModalPending,
  clearAccountReadyModalSeen,
  markAccountReadyModalPending,
  markAccountReadyModalSeen,
  readAccountReadyModalPending,
  readAccountReadyModalSeen,
  shouldShowAccountReadyModal,
  stripAccountReadySearchParam,
} from "@/lib/auth/account-ready-modal";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("account-ready-modal", () => {
  it("shows the modal once when account-ready=true is present and not yet seen", () => {
    expect(shouldShowAccountReadyModal(true, false)).toBe(true);
    expect(shouldShowAccountReadyModal(true, true)).toBe(false);
    expect(shouldShowAccountReadyModal(false, false)).toBe(false);
  });

  it("removes account-ready from the URL query string", () => {
    expect(stripAccountReadySearchParam("account-ready=true")).toBe("");
    expect(stripAccountReadySearchParam("account-ready=true&foo=bar")).toBe("foo=bar");
    expect(buildYourTrialPath("account-ready=true")).toBe("/your-trial");
    expect(buildYourTrialPath("account-ready=true&tenant=demo")).toBe("/your-trial?tenant=demo");
    expect(buildYourTrialPath("")).toBe("/your-trial");
  });

  it("persists modal seen state in session storage", () => {
    const storage = createMemoryStorage();
    expect(readAccountReadyModalSeen(storage)).toBe(false);
    markAccountReadyModalSeen(storage);
    expect(storage.getItem(ACCOUNT_READY_MODAL_SEEN_KEY)).toBe("true");
    expect(readAccountReadyModalSeen(storage)).toBe(true);
  });

  it("marks a pending modal from signup and clears previous seen state", () => {
    const storage = createMemoryStorage({ [ACCOUNT_READY_MODAL_SEEN_KEY]: "true" });
    markAccountReadyModalPending(storage);
    expect(readAccountReadyModalSeen(storage)).toBe(false);
    expect(readAccountReadyModalPending(storage)).toBe(true);
    expect(storage.getItem(ACCOUNT_READY_MODAL_PENDING_KEY)).toBe("true");
    clearAccountReadyModalPending(storage);
    expect(readAccountReadyModalPending(storage)).toBe(false);
  });

  it("clears the modal-seen flag", () => {
    const storage = createMemoryStorage({ [ACCOUNT_READY_MODAL_SEEN_KEY]: "true" });
    clearAccountReadyModalSeen(storage);
    expect(readAccountReadyModalSeen(storage)).toBe(false);
  });

  it("keeps the modal closed after Exit when account-ready was in the URL", () => {
    const storage = createMemoryStorage();
    markAccountReadyModalSeen(storage);
    expect(shouldShowAccountReadyModal(true, readAccountReadyModalSeen(storage))).toBe(false);
    expect(buildYourTrialPath("account-ready=true")).toBe("/your-trial");
  });
});
