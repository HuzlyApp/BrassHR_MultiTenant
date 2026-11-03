"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "brasshr_analytics_client_session_key";
const HEARTBEAT_MS = 60_000;
const MEANINGFUL_THROTTLE_MS = 15_000;

function getClientSessionKey(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(STORAGE_KEY, key);
    return key;
  } catch {
    return `sess_${Date.now()}`;
  }
}

function isStaffPath(pathname: string): boolean {
  return pathname.startsWith("/admin_recruiter") || pathname.startsWith("/braas-hr");
}

/**
 * First-party session analytics for staff surfaces.
 * - Does not treat cursor movement alone as productive work.
 * - Meaningful events: click, keydown (presence only), visibility visible, route change.
 * - Does not capture keystroke content, screenshots, or off-app browsing.
 */
export default function AnalyticsSessionTracker() {
  const pathname = usePathname() ?? "/";
  const lastMeaningfulRef = useRef(0);
  const clientKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isStaffPath(pathname)) return;

    clientKeyRef.current = getClientSessionKey();
    let cancelled = false;

    const post = async (payload: Record<string, unknown>) => {
      if (cancelled) return;
      try {
        await fetch("/api/admin/reports/team-productivity/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientSessionKey: clientKeyRef.current,
            module: pathname.startsWith("/admin_recruiter") ? "admin_recruiter" : "braas_hr",
            visibilityState: typeof document !== "undefined" ? document.visibilityState : "visible",
            ...payload,
          }),
          keepalive: true,
        });
      } catch {
        /* best-effort */
      }
    };

    const markMeaningful = () => {
      const now = Date.now();
      if (now - lastMeaningfulRef.current < MEANINGFUL_THROTTLE_MS) return;
      lastMeaningfulRef.current = now;
      void post({ meaningful: true });
    };

    void post({ meaningful: true });

    const onClick = () => markMeaningful();
    const onKey = () => markMeaningful();
    const onVisibility = () => {
      if (document.visibilityState === "visible") markMeaningful();
      else void post({ meaningful: false, visibilityState: "hidden" });
    };

    const interval = window.setInterval(() => {
      void post({ meaningful: false });
    }, HEARTBEAT_MS);

    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => {
      void post({ end: false, meaningful: false, visibilityState: "hidden" });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [pathname]);

  return null;
}
