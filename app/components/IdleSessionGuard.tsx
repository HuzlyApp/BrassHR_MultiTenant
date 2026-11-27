"use client";

import { isGodAdminUser } from "@/lib/auth/god-admin";
import { isStaffRole, parseAppRole } from "@/lib/auth/app-role";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getBrowserSession, isAuthLockContentionError } from "@/lib/auth/browser-session";
import {
  IDLE_ACTIVITY_THROTTLE_MS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_SESSION_COOKIE,
  idleLogoutRedirectPath,
  idleSessionCookieOptions,
  isIdleSessionExpired,
  parseLastActivityMs,
} from "@/lib/auth/idle-session";

function readActivityCookie(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${IDLE_SESSION_COOKIE}=`));
  if (!match) return null;
  return parseLastActivityMs(decodeURIComponent(match.slice(IDLE_SESSION_COOKIE.length + 1)));
}

function writeActivityCookie(atMs: number) {
  if (typeof document === "undefined") return;
  const { path, sameSite, maxAge } = idleSessionCookieOptions();
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${IDLE_SESSION_COOKIE}=${encodeURIComponent(String(atMs))}; Path=${path}; Max-Age=${maxAge}; SameSite=${sameSite}${secure}`;
}

function clearActivityCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${IDLE_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=lax`;
}

function isTrackedSessionUser(user: { id?: string; is_anonymous?: boolean } | null | undefined): boolean {
  return Boolean(user?.id) && user?.is_anonymous !== true;
}

/**
 * Ends non-anonymous sessions after {@link IDLE_TIMEOUT_MS} of no user interaction.
 * Anonymous applicant onboarding sessions are left alone.
 */
export default function IdleSessionGuard() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const lastWriteRef = useRef(0);
  const signingOutRef = useRef(false);
  const trackedRef = useRef(false);
  const staffRef = useRef(false);
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const checkStaff = async (touch: boolean) => {
      const path = pathnameRef.current;
      if (!(path.startsWith("/admin_recruiter") || path.startsWith("/godadmin") || path.startsWith("/braas-hr"))) return;
      try {
        const response = await fetch("/api/auth/session-activity", { method: touch ? "POST" : "GET", cache: "no-store" });
        if (response.status === 401 && trackedRef.current) await signOutForIdle();
      } catch { /* Server access still fails closed while connectivity recovers. */ }
    };

    const touchActivity = (force = false) => {
      const now = Date.now();
      if (!force && now - lastWriteRef.current < IDLE_ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      if (staffRef.current) void checkStaff(true);
      else writeActivityCookie(now);
    };

    const signOutForIdle = async () => {
      if (cancelled || signingOutRef.current) return;
      signingOutRef.current = true;
      trackedRef.current = false;
      try {
        clearActivityCookie();
        await supabaseBrowser.auth.signOut({ scope: "local" });
      } catch {
        /* still redirect */
      }
      if (!cancelled) {
        router.replace(idleLogoutRedirectPath(pathnameRef.current));
      }
      signingOutRef.current = false;
    };

    const enforceIfIdle = async () => {
      if (cancelled || signingOutRef.current || !trackedRef.current) return;

      if (staffRef.current) { await checkStaff(false); return; }
      const last = readActivityCookie();
      if (last == null) {
        touchActivity(true);
        return;
      }
      if (isIdleSessionExpired(last)) {
        await signOutForIdle();
      }
    };

    const onUserActivity = (event?: Event) => {
      if (!event?.isTrusted) return;
      if (pathnameRef.current.startsWith("/application") || pathnameRef.current.startsWith("/candidate-signin")) return;
      if (!trackedRef.current || signingOutRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        // visibilitychange to hidden is not activity; visible + other events are.
        return;
      }
      if (!staffRef.current && isIdleSessionExpired(readActivityCookie())) {
        void signOutForIdle();
        return;
      }
      touchActivity();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
      "mousemove",
    ];

    const onVisibility = () => {
      if (document.visibilityState === "visible") void enforceIfIdle();
    };

    for (const event of activityEvents) {
      window.addEventListener(event, onUserActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        trackedRef.current = false;
        clearActivityCookie();
        return;
      }

      staffRef.current = Boolean(session?.user && (isStaffRole(parseAppRole(session.user.app_metadata?.role) || "") || isGodAdminUser(session.user)));
      const tracked = isTrackedSessionUser(session?.user);
      trackedRef.current = tracked;
      if (!tracked) return;

      if (staffRef.current) { void checkStaff(false); return; }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (!staffRef.current && isIdleSessionExpired(readActivityCookie())) {
          void signOutForIdle();
          return;
        }
        touchActivity(true);
      }
    });

    void (async () => {
      let session: Session | null;
      try {
        session = await getBrowserSession();
      } catch (error) {
        if (!isAuthLockContentionError(error)) {
          console.warn("[idle-session-guard] could not read session", error);
        }
        return;
      }
      if (cancelled) return;
      staffRef.current = Boolean(session?.user && (isStaffRole(parseAppRole(session.user.app_metadata?.role) || "") || isGodAdminUser(session.user)));
      trackedRef.current = isTrackedSessionUser(session?.user);
      if (staffRef.current) { await checkStaff(false); return; }
      if (trackedRef.current) {
        if (!staffRef.current && isIdleSessionExpired(readActivityCookie())) {
          await signOutForIdle();
        } else {
          touchActivity(true);
        }
      }
    })();

    const intervalId = window.setInterval(() => {
      void enforceIfIdle();
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      subscription.unsubscribe();
      for (const event of activityEvents) {
        window.removeEventListener(event, onUserActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
