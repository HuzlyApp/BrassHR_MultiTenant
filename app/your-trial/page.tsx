"use client";

import Image from "next/image";
import AccountReadyModal from "@/app/components/AccountReadyModal";
import SignupStepper from "@/app/components/SignupStepper";
import { Fragment, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

const RIGHT_CHECK_ICON = "/icons/braas-HR/right-icon.svg";

const STATUS_ITEMS = [
  { label: "Account Created", icon: "/icons/braas-HR/account-created-icon.svg" },
  { label: "Demo Data Generated", icon: "/icons/braas-HR/demo-data-icon.svg" },
  { label: "Adding the final touches", icon: "/icons/braas-HR/final-touch-icon.svg" },
] as const;

const STATUS_ICON_BOX_SIZE = 64;
const STATUS_CONNECTOR_HEIGHT = 50;

function StatusList({ isCreated }: { isCreated: boolean }) {
  const innerIconSize = isCreated ? 42 : 36;

  return (
    <div className="mt-[48px]">
      {STATUS_ITEMS.map((item, index) => (
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
                src={isCreated ? RIGHT_CHECK_ICON : item.icon}
                alt=""
                width={innerIconSize}
                height={innerIconSize}
                className="object-contain"
                style={{ width: innerIconSize, height: innerIconSize }}
              />
            </span>
            <span className="text-[16px] font-normal leading-[24px] tracking-normal text-[#0f172a]" style={interStyle}>
              {item.label}
            </span>
          </div>
        </Fragment>
      ))}
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

const DEFAULT_VERIFICATION_EMAIL = "seandoe@gmail.com";

function YourTrialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAccountReady = searchParams.get("account-ready") === "true";
  const isCreated = searchParams.get("created") === "true" || isAccountReady;
  const [verificationEmail, setVerificationEmail] = useState(DEFAULT_VERIFICATION_EMAIL);

  useEffect(() => {
    if (!isAccountReady) return;

    try {
      const draft = localStorage.getItem("braasOwnerSignupDraft");
      if (!draft) return;

      const parsed = JSON.parse(draft) as { workEmail?: string };
      if (parsed.workEmail?.trim()) {
        setVerificationEmail(parsed.workEmail.trim());
      }
    } catch {
      // Keep default email when draft is missing or invalid.
    }
  }, [isAccountReady]);

  const handleExit = () => {
    router.push("/login");
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
      {isAccountReady ? (
        <AccountReadyModal email={verificationEmail} onExit={handleExit} />
      ) : null}

      <main
        className={`min-h-screen w-full overflow-x-hidden bg-white${isAccountReady ? " pointer-events-none select-none" : ""}`}
        style={{ backgroundColor: "#ffffff" }}
        aria-hidden={isAccountReady}
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

            <SignupStepper phase={isCreated ? "ready" : "preparing"} />

            <div className="mt-[58px]">
              <h1 className="text-[30px] font-semibold leading-[36px] tracking-normal text-[#0b0f19]" style={interStyle}>
                We&apos;re preparing your trial
              </h1>
              <p className="mt-[10px] text-[16px] font-normal leading-[24px] tracking-normal text-[#475569]" style={interStyle}>
                This only takes a few minutes. Please hang on a bit...
              </p>
            </div>

            <StatusList isCreated={isCreated} />

            <div className="min-h-[140px] flex-1" aria-hidden />

            <p className="text-[12px] font-normal leading-[16px] tracking-normal text-[#94a3b8]" style={interStyle}>
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
