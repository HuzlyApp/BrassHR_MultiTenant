"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getBrowserSession, isAuthLockContentionError } from "@/lib/auth/browser-session";
import { recruiterLogoutLoginHref } from "@/lib/auth/recruiter-sign-in";

/**
 * Sends anonymous sessions back to sign-in. The proxy already rejected them
 * before this HTML was produced, so the shell renders immediately and this
 * check does not sit on the navigation path.
 */
export function AdminStaffAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      let session: Session | null;
      try {
        session = await getBrowserSession();
      } catch (error) {
        if (!isAuthLockContentionError(error)) {
          console.warn("[admin-staff-auth-guard] could not read session", error);
        }
        if (!cancelled) setTimeout(() => void verify(), 2000);
        return;
      }
      const user = session?.user;

      if (!user?.id || user.is_anonymous === true) {
        if (!cancelled) {
          router.replace(recruiterLogoutLoginHref());
        }
      }
    };

    void verify();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => {
      // Defer: auth-js runs this callback while holding its session lock.
      setTimeout(() => void verify(), 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  return children;
}
