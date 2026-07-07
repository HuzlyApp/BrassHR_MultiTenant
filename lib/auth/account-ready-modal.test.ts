import { describe, expect, it } from "vitest";
import {
  ACCOUNT_READY_MODAL_SEEN_KEY,
  buildYourTrialPath,
  markAccountReadyModalSeen,
  readAccountReadyModalSeen,
  shouldShowAccountReadyModal,
  stripAccountReadySearchParam,
} from "@/lib/auth/account-ready-modal";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
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

  it("keeps the modal closed after Exit when account-ready was in the URL", () => {
    const storage = createMemoryStorage();
    markAccountReadyModalSeen(storage);
    expect(shouldShowAccountReadyModal(true, readAccountReadyModalSeen(storage))).toBe(false);
    expect(buildYourTrialPath("account-ready=true")).toBe("/your-trial");
  });
});
