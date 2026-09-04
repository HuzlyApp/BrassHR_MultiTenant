import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SYNC_STORAGE_KEY,
  authSyncEventFromAuthChange,
  createAuthSyncBus,
  isAuthEntryPath,
  isRestorableAuthSession,
  isSessionGuardedPath,
  reconcileAuthSessionFromStorage,
  restoreSessionAfterReload,
  shouldRejectStoredSession,
  type AuthSyncMessage,
  type RestorableSessionLike,
} from "@/lib/auth/cross-tab-session-sync";

function validSession(overrides: Partial<NonNullable<RestorableSessionLike>> = {}): NonNullable<RestorableSessionLike> {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_at: nowSec + 3600,
    user: { id: "user-a", is_anonymous: false },
    ...overrides,
  };
}

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

type ChannelListener = (event: MessageEvent) => void;

function createLinkedChannels() {
  const listenersA = new Set<ChannelListener>();
  const listenersB = new Set<ChannelListener>();

  const make = (self: Set<ChannelListener>, peer: Set<ChannelListener>) => {
    return {
      addEventListener: (_type: "message", listener: ChannelListener) => {
        self.add(listener);
      },
      removeEventListener: (_type: "message", listener: ChannelListener) => {
        self.delete(listener);
      },
      postMessage: (data: unknown) => {
        for (const listener of peer) {
          listener({ data } as MessageEvent);
        }
      },
      close: () => {
        self.clear();
      },
    } as unknown as BroadcastChannel;
  };

  return {
    channelA: make(listenersA, listenersB),
    channelB: make(listenersB, listenersA),
  };
}

describe("isRestorableAuthSession / shouldRejectStoredSession", () => {
  const now = 1_700_000_000_000;

  it("accepts a valid cookie session", () => {
    expect(isRestorableAuthSession(validSession({ expires_at: now / 1000 + 60 }), now)).toBe(true);
    expect(shouldRejectStoredSession(validSession({ expires_at: now / 1000 + 60 }), now)).toBe(false);
  });

  it("rejects missing tokens or user", () => {
    expect(isRestorableAuthSession(null, now)).toBe(false);
    expect(isRestorableAuthSession({ access_token: "", refresh_token: "r", user: { id: "u" } }, now)).toBe(
      false
    );
    expect(
      isRestorableAuthSession({ access_token: "a", refresh_token: "r", user: { id: "" } }, now)
    ).toBe(false);
  });

  it("rejects expired sessions without a refresh token", () => {
    const expired: RestorableSessionLike = {
      access_token: "a",
      refresh_token: "",
      expires_at: now / 1000 - 10,
      user: { id: "user-a" },
    };
    expect(isRestorableAuthSession(expired, now)).toBe(false);
    expect(shouldRejectStoredSession(expired, now)).toBe(true);
  });

  it("allows expired access tokens when a refresh token can renew the session", () => {
    const expiredButRefreshable: RestorableSessionLike = {
      access_token: "a",
      refresh_token: "refresh-token",
      expires_at: now / 1000 - 10,
      user: { id: "user-a" },
    };
    expect(isRestorableAuthSession(expiredButRefreshable, now)).toBe(true);
    expect(shouldRejectStoredSession(expiredButRefreshable, now)).toBe(false);
  });
});

describe("path helpers", () => {
  it("detects auth entry and guarded paths", () => {
    expect(isAuthEntryPath("/admin")).toBe(true);
    expect(isAuthEntryPath("/login?role=admin_recruiter")).toBe(false);
    expect(isAuthEntryPath("/login")).toBe(true);
    expect(isAuthEntryPath("/worker-signin")).toBe(true);
    expect(isSessionGuardedPath("/admin_recruiter/dashboard")).toBe(true);
    expect(isSessionGuardedPath("/godadmin/tenants")).toBe(true);
    expect(isSessionGuardedPath("/admin")).toBe(false);
  });
});

describe("authSyncEventFromAuthChange", () => {
  it("maps supabase auth events to sync messages", () => {
    expect(authSyncEventFromAuthChange("SIGNED_IN")).toBe("SIGNED_IN");
    expect(authSyncEventFromAuthChange("SIGNED_OUT")).toBe("SIGNED_OUT");
    expect(authSyncEventFromAuthChange("TOKEN_REFRESHED")).toBe("SESSION_CHANGED");
    expect(authSyncEventFromAuthChange("INITIAL_SESSION")).toBeNull();
  });
});

describe("cross-tab session sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sign in in Tab A, then reload Tab B restores the cookie session", () => {
    // Tab A writes the shared cookie session (modeled as stored session).
    const cookieSession = validSession({ user: { id: "user-a" } });

    // Tab B reload: validate stored session and restore signed-in state.
    expect(restoreSessionAfterReload(cookieSession)).toEqual({
      status: "signed_in",
      userId: "user-a",
      anonymous: false,
    });
  });

  it("sign in in Tab A notifies Tab B immediately", () => {
    const { channelA, channelB } = createLinkedChannels();
    const storage = new MemoryStorage();
    const storageListeners: Array<(event: StorageEvent) => void> = [];

    const tabA = createAuthSyncBus({
      createChannel: () => channelA,
      storage,
      addStorageListener: (listener) => {
        storageListeners.push(listener);
        return () => {
          const idx = storageListeners.indexOf(listener);
          if (idx >= 0) storageListeners.splice(idx, 1);
        };
      },
    });
    const tabB = createAuthSyncBus({
      createChannel: () => channelB,
      storage,
      addStorageListener: (listener) => {
        storageListeners.push(listener);
        return () => {
          const idx = storageListeners.indexOf(listener);
          if (idx >= 0) storageListeners.splice(idx, 1);
        };
      },
    });

    const tabBMessages: AuthSyncMessage[] = [];
    tabB.subscribe((message) => tabBMessages.push(message));

    const signedIn: AuthSyncMessage = {
      type: "SIGNED_IN",
      at: 1_700_000_000_100,
      userId: "user-a",
    };
    tabA.publish(signedIn);

    expect(tabBMessages).toEqual([signedIn]);

    // Tab B reconciles from the shared cookie session after the notify.
    const cookieSession = validSession({ user: { id: "user-a" } });
    expect(reconcileAuthSessionFromStorage(cookieSession)).toMatchObject({
      status: "signed_in",
      userId: "user-a",
    });

    tabA.close();
    tabB.close();
  });

  it("sign out in Tab A signs out Tab B", () => {
    const { channelA, channelB } = createLinkedChannels();
    const storage = new MemoryStorage();

    const tabA = createAuthSyncBus({
      createChannel: () => channelA,
      storage,
      addStorageListener: () => () => {},
    });
    const tabB = createAuthSyncBus({
      createChannel: () => channelB,
      storage,
      addStorageListener: () => () => {},
    });

    const tabBMessages: AuthSyncMessage[] = [];
    tabB.subscribe((message) => tabBMessages.push(message));

    tabA.publish({ type: "SIGNED_OUT", at: 1_700_000_000_200, userId: null });

    expect(tabBMessages).toEqual([
      { type: "SIGNED_OUT", at: 1_700_000_000_200, userId: null },
    ]);

    // After Tab A clears cookies, Tab B reload/reconcile sees signed out.
    expect(reconcileAuthSessionFromStorage(null)).toEqual({ status: "signed_out" });

    tabA.close();
    tabB.close();
  });

  it("rejects expired or invalid sessions on restore", () => {
    const now = 1_700_000_000_000;
    const expired: RestorableSessionLike = {
      access_token: "stale-access",
      refresh_token: null,
      expires_at: now / 1000 - 1,
      user: { id: "user-a" },
    };
    const invalid: RestorableSessionLike = {
      access_token: "x",
      refresh_token: "y",
      expires_at: now / 1000 + 60,
      user: { id: null },
    };

    expect(restoreSessionAfterReload(expired, now)).toEqual({ status: "rejected" });
    expect(restoreSessionAfterReload(invalid, now)).toEqual({ status: "rejected" });
    expect(shouldRejectStoredSession(expired, now)).toBe(true);
    expect(shouldRejectStoredSession(invalid, now)).toBe(true);
  });

  it("falls back to the storage event when BroadcastChannel is unavailable", () => {
    const storage = new MemoryStorage();
    const storageListeners: Array<(event: StorageEvent) => void> = [];

    const addStorageListener = (listener: (event: StorageEvent) => void) => {
      storageListeners.push(listener);
      return () => {
        const idx = storageListeners.indexOf(listener);
        if (idx >= 0) storageListeners.splice(idx, 1);
      };
    };

    // Wrap storage so Tab A writes fan out as storage events to Tab B (other tabs only).
    const tabAStorage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        const oldValue = storage.getItem(key);
        storage.setItem(key, value);
        for (const listener of storageListeners) {
          listener({
            key,
            newValue: value,
            oldValue,
            storageArea: storage as unknown as Storage,
          } as StorageEvent);
        }
      },
      removeItem: (key) => {
        const oldValue = storage.getItem(key);
        storage.removeItem(key);
        for (const listener of storageListeners) {
          listener({
            key,
            newValue: null,
            oldValue,
            storageArea: storage as unknown as Storage,
          } as StorageEvent);
        }
      },
    };

    const tabA = createAuthSyncBus({
      createChannel: () => null,
      storage: tabAStorage,
      addStorageListener,
    });
    const tabB = createAuthSyncBus({
      createChannel: () => null,
      storage,
      addStorageListener,
    });

    const tabBMessages: AuthSyncMessage[] = [];
    tabB.subscribe((message) => tabBMessages.push(message));

    const message: AuthSyncMessage = {
      type: "SIGNED_IN",
      at: 1_700_000_000_300,
      userId: "user-b",
    };
    tabA.publish(message);

    expect(tabBMessages).toEqual([message]);
    expect(storage.getItem(AUTH_SYNC_STORAGE_KEY)).toBeNull();

    tabA.close();
    tabB.close();
  });
});
