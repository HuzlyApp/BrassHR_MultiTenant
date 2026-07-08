"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { recruiterLogoutLoginHref } from "@/lib/auth/recruiter-sign-in";

/**
 * Blocks anonymous / missing sessions on recruiter admin routes.
 * Applicant onboarding used to replace staff cookies — this sends users back to sign in.
 */
export function AdminStaffAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      const user = session?.user;

      if (!user?.id || user.is_anonymous === true) {
        if (user?.is_anonymous === true) {
          await supabaseBrowser.auth.signOut();
        }
        if (!cancelled) {
          router.replace(recruiterLogoutLoginHref());
        }
        return;
      }

      if (!cancelled) setAllowed(true);
    };

    void verify();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => {
      void verify();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-sm text-slate-600">
        Checking sign-in…
      </div>
    );
  }

  return <>{children}</>;
}
