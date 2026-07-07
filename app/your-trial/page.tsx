"use client";

import Image from "next/image";
import AccountReadyModal from "@/app/components/AccountReadyModal";
import SignupStepper from "@/app/components/SignupStepper";
import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildYourTrialPath,
  markAccountReadyModalSeen,
  readAccountReadyModalSeen,
} from "@/lib/auth/account-ready-modal";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

const RIGHT_CHECK_ICON = "/icons/braas-HR/right-icon.svg";

const STATUS_ITEMS = [
  { label: "Account Created", icon: "/icons/braas-HR/account-created-icon.svg" },
  { label: "Demo Data Generated", icon: "/icons/braas-HR/demo-data-icon.svg" },
  { label: "Adding the final touches", icon: "/icons/braas-HR/final-touch-icon.svg" },
] as const;

const STATUS_ICON_BOX_SIZE = 64;
const STATUS_CONNECTOR_HEIGHT = 50;
const STEP_DELAY_MS = 1400;
const PREP_SLOW_MESSAGE_MS = 5 * 60 * 1000;

type TrialStatusPayload = {
  phase?: "preparing" | "email_sent" | "onboarding_complete";
  emailSent?: boolean;
  error?: string;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function StatusList({ completedThrough }: { completedThrough: number }) {
  return (
    <div className="mt-[48px]">
      {STATUS_ITEMS.map((item, index) => {
        const isComplete = index <= completedThrough;
        const innerIconSize = isComplete ? 42 : 36;

        return (
          <Fragment key={item.label}>
            {index > 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ height: STATUS_CONNECTOR_HEIGHT, width: STATUS_ICON_BOX_SIZE }}
                aria-hidden
              >
                <span className="w-px bg-[#e8edf4]" style={{ height: STATUS_CONNECTOR_HEIGHT }} />
              </div>
            ) : null}
            <div className="flex items-center gap-[16px]">
              <span
                className="flex shrink-0 items-center justify-center rounded-[12px] bg-[#F3F4F6]"
                style={{ width: STATUS_ICON_BOX_SIZE, height: STATUS_ICON_BOX_SIZE }}
              >
                <Image
                  src={isComplete ? RIGHT_CHECK_ICON : item.icon}
                  alt=""
                  width={innerIconSize}
                  height={innerIconSize}
                  className="object-contain"
                  style={{ width: innerIconSize, height: innerIconSize }}
                />
              </span>
              <span
                className="text-[16px] font-normal leading-[24px] tracking-normal text-[#0f172a]"
                style={interStyle}
              >
                {item.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function TrialArtPanel() {
  return (
    <aside className="trial-art relative flex w-full flex-col items-center justify-center gap-[40px] self-stretch overflow-hidden rounded-[24px] bg-[#111827] p-[30px]">
      <Image
        src="/images/singup-bg-image.jpg"
        alt="Brass HR"
        fill
        sizes="510px"
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-[40px] text-center">
        <Image
          src="/icons/braas-HR/white-BrassHR-logo.svg"
          alt="Brass HR"
          width={160}
          height={80}
          priority
          className="h-[80px] w-[160px] object-contain"
        />
        <p
          className="max-w-[300px] text-center text-[24px] font-bold leading-[30px] tracking-[0.03em] text-white"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          HR Simplified for growing teams
        </p>
      </div>
    </aside>
  );
}

function YourTrialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAccountReadyFromUrl = searchParams.get("account-ready") === "true";
  const [showAccountReadyModal, setShowAccountReadyModal] = useState(false);
  const [trialPrepared, setTrialPrepared] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [completedThrough, setCompletedThrough] = useState(0);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [slowMessage, setSlowMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const preparationStartedRef = useRef(false);

  const cleanAccountReadyUrl = useCallback(() => {
    if (searchParams.get("account-ready") !== "true") return;
    router.replace(buildYourTrialPath(searchParams.toString()), { scroll: false });
  }, [router, searchParams]);

  const openAccountReadyModalOnce = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (readAccountReadyModalSeen(sessionStorage)) return false;
    markAccountReadyModalSeen(sessionStorage);
    setShowAccountReadyModal(true);
    return true;
  }, []);

  const markTrialReady = useCallback(() => {
    setTrialPrepared(true);
    setCompletedThrough(2);
    setSlowMessage(null);
    openAccountReadyModalOnce();
  }, [openAccountReadyModalOnce]);

  const fetchTrialStatus = useCallback(async (): Promise<TrialStatusPayload | null> => {
    try {
      const res = await fetch("/api/auth/signup/trial-status", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as TrialStatusPayload;
      if (!res.ok) return { error: json.error || "Unauthorized" };
      return json;
    } catch {
      return { error: "Network error while checking trial status." };
    }
  }, []);

  useEffect(() => {
    if (!isAccountReadyFromUrl) return;

    setTrialPrepared(true);
    setCompletedThrough(2);
    openAccountReadyModalOnce();
    cleanAccountReadyUrl();
  }, [isAccountReadyFromUrl, cleanAccountReadyUrl, openAccountReadyModalOnce]);

  useEffect(() => {
    try {
      const draft = localStorage.getItem("braasOwnerSignupDraft");
      if (!draft) return;
      const parsed = JSON.parse(draft) as { workEmail?: string };
      if (parsed.workEmail?.trim()) {
        setVerificationEmail(parsed.workEmail.trim());
      }
    } catch {
      // ignore invalid draft
    }
  }, []);

  useEffect(() => {
    if (trialPrepared || isAccountReadyFromUrl) return;
    if (preparationStartedRef.current) return;
    preparationStartedRef.current = true;

    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) {
        setSlowMessage(
          "This is taking longer than expected. We'll email your setup link shortly. You can stay on this page or use Resend setup link below."
        );
      }
    }, PREP_SLOW_MESSAGE_MS);

    async function runPreparation() {
      const beginRes = await fetch("/api/auth/signup/begin-trial-session", { method: "POST" });
      if (!beginRes.ok && beginRes.status !== 401) {
        const json = (await beginRes.json().catch(() => ({}))) as { error?: string };
        setPrepareError(json.error || "Could not start trial preparation.");
        return;
      }

      const existingStatus = await fetchTrialStatus();
      if (cancelled) return;
      if (existingStatus?.phase === "email_sent" || existingStatus?.phase === "onboarding_complete") {
        markTrialReady();
        return;
      }

      setCompletedThrough(0);
      await delay(STEP_DELAY_MS);
      if (cancelled) return;

      setCompletedThrough(1);
      let emailDelivered = false;
      try {
        const res = await fetch("/api/auth/signup/prepare-trial", { method: "POST" });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          sent?: boolean;
          skipped?: boolean;
          failed?: boolean;
          reason?: string | null;
        };

        if (!res.ok) {
          if (res.status === 401) {
            const statusAfterAuthLoss = await fetchTrialStatus();
            if (statusAfterAuthLoss?.phase === "email_sent") {
              emailDelivered = true;
            } else {
              setPrepareError(
                "Your sign-in session expired, but trial preparation can continue. Use Resend setup link below if needed."
              );
            }
          } else {
            setPrepareError(json.error || "Could not finish preparing your trial.");
          }
        } else if (json.sent || (json.skipped && json.reason === "ALREADY_SENT")) {
          emailDelivered = true;
        } else if (json.failed || json.skipped) {
          setPrepareError(
            json.reason === "RESEND_NOT_CONFIGURED"
              ? "Email delivery is not configured on this server. Contact support for your setup link."
              : "We could not send your setup email. Use Resend setup link below to try again."
          );
        } else {
          setPrepareError("We could not confirm your setup email was sent. Use Resend setup link below.");
        }
      } catch {
        setPrepareError("Network error while preparing your trial.");
      }

      await delay(STEP_DELAY_MS);
      if (cancelled) return;
      setCompletedThrough(2);

      await delay(STEP_DELAY_MS);
      if (cancelled) return;

      if (emailDelivered) {
        markTrialReady();
        return;
      }

      const polled = await fetchTrialStatus();
      if (polled?.phase === "email_sent" || polled?.phase === "onboarding_complete") {
        markTrialReady();
      }
    }

    void runPreparation();
    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [trialPrepared, isAccountReadyFromUrl, fetchTrialStatus, markTrialReady]);

  const handleExit = () => {
    setShowAccountReadyModal(false);
    if (typeof window !== "undefined") {
      markAccountReadyModalSeen(sessionStorage);
    }
    cleanAccountReadyUrl();
  };

  const handleResendSetupLink = async () => {
    setResending(true);
    setPrepareError(null);
    try {
      const res = await fetch("/api/auth/signup/resend-onboarding-link", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: boolean;
        skipped?: boolean;
        reason?: string | null;
      };

      if (!res.ok) {
        setPrepareError(json.error || "Could not resend setup link.");
        return;
      }

      if (json.sent || (json.skipped && json.reason === "ALREADY_SENT")) {
        setPrepareError(null);
        setSlowMessage(null);
        return;
      }

      setPrepareError("Could not resend setup link. Please try again in a moment.");
    } catch {
      setPrepareError("Network error while resending setup link.");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    const previousHtmlBg = document.documentElement.style.backgroundColor;
    const previousBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#ffffff";
    document.body.style.backgroundColor = "#ffffff";

    return () => {
      document.documentElement.style.backgroundColor = previousHtmlBg;
      document.body.style.backgroundColor = previousBodyBg;
    };
  }, []);

  return (
    <>
      {showAccountReadyModal ? (
        <AccountReadyModal
          email={verificationEmail || "your email"}
          onExit={handleExit}
          onResend={handleResendSetupLink}
          resending={resending}
        />
      ) : null}

      <main
        className={`min-h-screen w-full overflow-x-hidden bg-white${showAccountReadyModal ? " pointer-events-none select-none" : ""}`}
        style={{ backgroundColor: "#ffffff" }}
        aria-hidden={showAccountReadyModal}
      >
        <style>{`
        .trial-frame {
          box-sizing: border-box;
          padding: clamp(32px, 5.55vw, 80px);
        }

        .trial-layout {
          display: grid;
          grid-template-columns: minmax(520px, 770px) minmax(340px, 510px);
          gap: 0;
          justify-content: center;
          align-items: stretch;
        }

        .trial-content {
          width: 100%;
          max-width: 770px;
          min-height: 800px;
          padding: 20px 80px 20px 20px;
          display: flex;
          flex-direction: column;
        }

        .trial-art {
          width: 100%;
          max-width: 510px;
          height: 800px;
          min-height: 800px;
        }

        @media (min-width: 1440px) {
          .trial-frame {
            width: 1440px;
            max-width: 1440px;
            min-height: 1024px;
            height: 1140px;
            padding: 80px;
          }

          .trial-layout {
            width: 1280px;
            grid-template-columns: 770px 510px;
          }

          .trial-content {
            width: 770px;
            height: 800px;
          }

          .trial-art {
            width: 510px;
            height: 800px;
          }
        }
      `}</style>

        <section className="trial-frame mx-auto w-full rounded-[24px] bg-white">
          <div className="trial-layout w-full rounded-[12px] bg-white">
            <div className="trial-content">
              <Image
                src="/icons/braas-HR/BrassHR-logo.svg"
                alt="Brass HR"
                width={160}
                height={80}
                priority
                className="h-[80px] w-[160px] object-contain"
              />

              <SignupStepper phase={trialPrepared ? "ready" : "preparing"} />

              <div className="mt-[58px]">
                <h1
                  className="text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]"
                  style={interStyle}
                >
                  We&apos;re preparing your trial
                </h1>
                <p
                  className="mt-[10px] text-[16px] font-normal leading-[24px] tracking-normal text-[#475569]"
                  style={interStyle}
                >
                  This only takes a few minutes. Please hang on a bit...
                </p>
                {slowMessage ? (
                  <p className="mt-3 text-sm text-[#475569]">{slowMessage}</p>
                ) : null}
                {prepareError ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-red-700">{prepareError}</p>
                    <button
                      type="button"
                      onClick={() => void handleResendSetupLink()}
                      disabled={resending}
                      className="rounded-[8px] border border-[#BC8B41] px-4 py-2 text-sm font-semibold text-[#BC8B41] transition hover:bg-[#BC8B41]/5 disabled:opacity-60"
                    >
                      {resending ? "Sending…" : "Resend setup link"}
                    </button>
                  </div>
                ) : null}
              </div>

              <StatusList completedThrough={completedThrough} />

              <div className="min-h-[140px] flex-1" aria-hidden />

              <p
                className="text-[12px] font-normal leading-[16px] tracking-normal text-[#94a3b8]"
                style={interStyle}
              >
                Join 20,000+ companies in 190+ countries using Brass - HRsimplified
              </p>
            </div>

            <TrialArtPanel />
          </div>
        </section>
      </main>
    </>
  );
}

export default function YourTrialPage() {
  return (
    <Suspense fallback={null}>
      <YourTrialContent />
    </Suspense>
  );
}
