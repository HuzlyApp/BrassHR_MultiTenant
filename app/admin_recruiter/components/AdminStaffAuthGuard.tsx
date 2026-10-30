"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import AuthenticatorChallengeCard from "@/app/components/auth/AuthenticatorChallengeCard";
import { readAuthenticatorChallengeState } from "@/lib/auth/authenticator-mfa";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getBrowserSession, isAuthLockContentionError } from "@/lib/auth/browser-session";
import { recruiterLogoutLoginHref } from "@/lib/auth/recruiter-sign-in";

type StaffGate = "checking" | "ready" | "challenge" | "unavailable";

/**
 * Sends anonymous sessions back to sign-in, and holds the admin app until a
 * verified authenticator code has been accepted for this session.
 */
export function AdminStaffAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gate, setGate] = useState<StaffGate>("checking");
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let request = 0;

    const verify = async () => {
      const requestId = ++request;
      let session: Session | null;
      try {
        session = await getBrowserSession();
      } catch (error) {
        if (cancelled || requestId !== request) return;
        if (!isAuthLockContentionError(error)) {
          console.warn("[admin-staff-auth-guard] could not read session", error);
        }
        setTimeout(() => void verify(), 2000);
        return;
      }
      if (cancelled || requestId !== request) return;
      const user = session?.user;

      if (!user?.id || user.is_anonymous === true) {
        router.replace(recruiterLogoutLoginHref());
        return;
      }

      try {
        const challengeState = await readAuthenticatorChallengeState(supabaseBrowser);
        if (cancelled || requestId !== request) return;
        setGate(
          challengeState === "challenge"
            ? "challenge"
            : challengeState === "unavailable"
              ? "unavailable"
              : "ready"
        );
      } catch (error) {
        if (cancelled || requestId !== request) return;
        if (isAuthLockContentionError(error)) {
          setTimeout(() => void verify(), 2000);
          return;
        }
        setGate("unavailable");
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
  }, [router, checkAttempt]);

  if (gate === "checking") {
    return <div className="min-h-screen bg-[#F4F4F4]" aria-busy="true" />;
  }

  if (gate === "unavailable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F4F4] px-4">
        <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 text-center">
          <p className="text-sm text-[#374151]">Could not confirm your authenticator. Try again.</p>
          <button
            type="button"
            onClick={() => {
              setGate("checking");
              setCheckAttempt((attempt) => attempt + 1);
            }}
            className="mt-4 h-9 rounded-lg bg-[#012352] px-3 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (gate === "challenge") {
    return (
      <AuthenticatorChallengeCard
        layout="page"
        onVerified={() => setGate("ready")}
        onCancel={async () => {
          await supabaseBrowser.auth.signOut();
          router.replace(recruiterLogoutLoginHref());
        }}
      />
    );
  }

  return children;
}
