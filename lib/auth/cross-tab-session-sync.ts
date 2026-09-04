/**
 * Cross-tab authentication sync for the cookie-backed Supabase browser session.
 *
 * The authenticated JWT still lives in the existing `@supabase/ssr` cookie store.
 * This module only coordinates UI/session reconciliation across same-origin tabs via
 * BroadcastChannel (primary) and the `storage` event (fallback). Messages never carry
 * tokens — other tabs re-read and validate the shared cookie session.
 */

export const AUTH_SYNC_CHANNEL = "brasshr-auth-session-sync";
export const AUTH_SYNC_STORAGE_KEY = "brasshr-auth-session-sync";

export type AuthSyncEvent = "SIGNED_IN" | "SIGNED_OUT" | "SESSION_CHANGED";

export type AuthSyncMessage = {
  type: AuthSyncEvent;
  /** Unix ms; used for dedupe across BroadcastChannel + storage fallback. */
  at: number;
  /** Optional user id hint — never tokens. */
  userId?: string | null;
};

/** Minimal session shape used for restore validation (no network). */
export type RestorableSessionLike = {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  user?: { id?: string | null; is_anonymous?: boolean } | null;
} | null;

export function isAuthSyncMessage(value: unknown): value is AuthSyncMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as Record<string, unknown>;
  if (msg.type !== "SIGNED_IN" && msg.type !== "SIGNED_OUT" && msg.type !== "SESSION_CHANGED") {
    return false;
  }
  if (typeof msg.at !== "number" || !Number.isFinite(msg.at) || msg.at <= 0) return false;
  if (
    msg.userId !== undefined &&
    msg.userId !== null &&
    typeof msg.userId !== "string"
  ) {
    return false;
  }
  return true;
}

/**
 * Whether a stored cookie session may restore signed-in access.
 * Rejects missing/invalid shapes and expired sessions that cannot refresh.
 * Near-expiry sessions with a refresh token remain restorable (SDK refresh unchanged).
 */
export function isRestorableAuthSession(
  session: RestorableSessionLike,
  nowMs: number = Date.now()
): boolean {
  if (!session) return false;
  const access = typeof session.access_token === "string" ? session.access_token.trim() : "";
  const userId = session.user?.id?.trim();
  if (!access || !userId) return false;

  const refresh =
    typeof session.refresh_token === "string" ? session.refresh_token.trim() : "";
  const expiresAt =
    typeof session.expires_at === "number" && Number.isFinite(session.expires_at)
      ? session.expires_at
      : null;

  if (expiresAt != null && expiresAt * 1000 <= nowMs && !refresh) {
    return false;
  }

  return true;
}

/** True when storage held a session-like value that must not restore access. */
export function shouldRejectStoredSession(
  session: RestorableSessionLike,
  nowMs: number = Date.now()
): boolean {
  if (session == null) return false;
  return !isRestorableAuthSession(session, nowMs);
}

export function authSyncEventFromAuthChange(
  event: string
): AuthSyncEvent | null {
  if (event === "SIGNED_IN") return "SIGNED_IN";
  if (event === "SIGNED_OUT") return "SIGNED_OUT";
  if (
    event === "TOKEN_REFRESHED" ||
    event === "USER_UPDATED" ||
    event === "PASSWORD_RECOVERY"
  ) {
    return "SESSION_CHANGED";
  }
  return null;
}

/** Auth entry URLs where a remote SIGNED_IN should refresh so middleware can redirect. */
export function isAuthEntryPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signin" ||
    pathname.startsWith("/signin/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/worker-signin" ||
    pathname.startsWith("/worker-signin/")
  );
}

/** Paths that should leave when another tab signs out the shared cookie session. */
export function isSessionGuardedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin_recruiter") ||
    pathname.startsWith("/godadmin") ||
    pathname.startsWith("/application") ||
    pathname === "/worker-onboarding" ||
    pathname.startsWith("/worker-onboarding/") ||
    pathname.startsWith("/tenant-onboarding")
  );
}

export type AuthSyncBus = {
  publish: (message: AuthSyncMessage) => void;
  subscribe: (handler: (message: AuthSyncMessage) => void) => () => void;
  close: () => void;
};

type AuthSyncBusOptions = {
  channelName?: string;
  storageKey?: string;
  /** Inject for tests. */
  createChannel?: (name: string) => BroadcastChannel | null;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  addStorageListener?: (listener: (event: StorageEvent) => void) => () => void;
};

/**
 * Same-origin tab bus: BroadcastChannel when available, plus localStorage
 * `storage` events so tabs without BC (or when BC fails) still reconcile.
 */
export function createAuthSyncBus(options: AuthSyncBusOptions = {}): AuthSyncBus {
  const channelName = options.channelName ?? AUTH_SYNC_CHANNEL;
  const storageKey = options.storageKey ?? AUTH_SYNC_STORAGE_KEY;
  const storage = options.storage === undefined ? defaultLocalStorage() : options.storage;

  let channel: BroadcastChannel | null = null;
  try {
    if (options.createChannel) {
      channel = options.createChannel(channelName);
    } else if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(channelName);
    }
  } catch {
    channel = null;
  }

  const handlers = new Set<(message: AuthSyncMessage) => void>();

  const deliver = (raw: unknown) => {
    if (!isAuthSyncMessage(raw)) return;
    for (const handler of handlers) {
      handler(raw);
    }
  };

  const onChannelMessage = (event: MessageEvent) => {
    deliver(event.data);
  };
  channel?.addEventListener("message", onChannelMessage);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || event.newValue == null) return;
    try {
      deliver(JSON.parse(event.newValue) as unknown);
    } catch {
      /* ignore malformed */
    }
  };

  const removeStorageListener =
    options.addStorageListener?.(onStorage) ??
    (() => {
      if (typeof window === "undefined") return () => {};
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    })();

  return {
    publish(message: AuthSyncMessage) {
      if (!isAuthSyncMessage(message)) return;
      try {
        channel?.postMessage(message);
      } catch {
        /* ignore */
      }
      if (storage) {
        try {
          storage.setItem(storageKey, JSON.stringify(message));
          // Same-tab storage events do not fire; clearing keeps the key ephemeral.
          storage.removeItem(storageKey);
        } catch {
          /* ignore quota / private mode */
        }
      }
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close() {
      handlers.clear();
      try {
        channel?.removeEventListener("message", onChannelMessage);
        channel?.close();
      } catch {
        /* ignore */
      }
      channel = null;
      removeStorageListener();
    },
  };
}

function defaultLocalStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export type ReconcileAuthSessionResult =
  | { status: "signed_in"; userId: string; anonymous: boolean }
  | { status: "signed_out" }
  | { status: "rejected" };

/**
 * Re-read the shared cookie session and decide whether this tab may stay signed in.
 * Does not perform sign-out itself — callers clear invalid sessions.
 */
export function reconcileAuthSessionFromStorage(
  session: RestorableSessionLike,
  nowMs: number = Date.now()
): ReconcileAuthSessionResult {
  if (session == null) {
    return { status: "signed_out" };
  }
  if (shouldRejectStoredSession(session, nowMs)) {
    return { status: "rejected" };
  }
  if (!isRestorableAuthSession(session, nowMs)) {
    return { status: "signed_out" };
  }
  return {
    status: "signed_in",
    userId: session!.user!.id!.trim(),
    anonymous: session!.user?.is_anonymous === true,
  };
}

/**
 * Simulates Tab B reacting after Tab A signed in, then Tab B reloads from cookies.
 */
export function restoreSessionAfterReload(
  storedSession: RestorableSessionLike,
  nowMs: number = Date.now()
): ReconcileAuthSessionResult {
  return reconcileAuthSessionFromStorage(storedSession, nowMs);
}
