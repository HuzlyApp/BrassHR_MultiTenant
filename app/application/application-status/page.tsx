"use client";

import { applicationPath } from "@/lib/tenant/with-tenant";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import ApplicantRecruiterNotes from "@/app/application/components/ApplicantRecruiterNotes";
import type { ApplicationStatusKey } from "@/lib/applicant-portal";
import { sendApplicationSubmissionEmail } from "@/lib/onboarding/send-application-submission-email";

type ApplicationStatusResponse = {
  applicationStatus?: ApplicationStatusKey;
  statusLabel?: string;
  submittedAt?: string;
};

function formatSubmittedDate(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  }
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadgeClass(status: ApplicationStatusKey): string {
  if (status === "approved") return "bg-[#2ec9b5]";
  if (status === "rejected") return "bg-[#ef4444]";
  if (status === "under_review") return "bg-[#3b82f6]";
  return "bg-[#f59e0b]";
}

function statusIconSrc(status: ApplicationStatusKey): string {
  return status === "approved" ? "/icons/approved.svg" : "/icons/pending.svg";
}

function statusHeading(status: ApplicationStatusKey): string {
  if (status === "approved") return "Application Approved";
  if (status === "rejected") return "Application Not Approved";
  if (status === "under_review") return "Application Under Review";
  return "Application Submitted";
}

function statusDescription(status: ApplicationStatusKey): string {
  if (status === "approved") {
    return "Congratulations! Your application was approved. We also sent you an email about your status and next steps.";
  }
  if (status === "rejected") {
    return "Your application was not approved at this time. Check your email or recruiter notes below for more information.";
  }
  if (status === "under_review") {
    return "Your application is under review. We will email you when there is an update.";
  }
  return "Current status is pending and we will provide updates within 48 hours. You can return here anytime to check your status—we will also email you about verification updates.";
}

export default function ApplicationStatusPage() {
  const emailSentRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatusKey>("pending");
  const [statusLabel, setStatusLabel] = useState("Pending");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const applicantId =
        typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || "" : "";
      if (!applicantId) {
        if (alive) {
          setSubmittedAt(new Date().toISOString());
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/onboarding/application-status?applicantId=${encodeURIComponent(applicantId)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as ApplicationStatusResponse;
        if (!alive) return;
        if (res.ok) {
          setApplicationStatus(data.applicationStatus ?? "pending");
          setStatusLabel(data.statusLabel ?? "Pending");
          setSubmittedAt(data.submittedAt ?? new Date().toISOString());
        } else {
          setSubmittedAt(new Date().toISOString());
        }
      } catch {
        if (alive) setSubmittedAt(new Date().toISOString());
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (emailSentRef.current) return;
    const applicantId = localStorage.getItem("applicantId")?.trim();
    if (!applicantId) return;
    emailSentRef.current = true;

    void fetch("/api/onboarding/continuation-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).catch(() => {
      /* best-effort tracking only */
    });

    void sendApplicationSubmissionEmail(applicantId).catch(() => {
      /* best-effort; status page still renders */
    });
  }, []);

  const isApproved = applicationStatus === "approved";
  const submittedDateLabel = formatSubmittedDate(submittedAt);

  return (
    <OnboardingLayout
      cardClassName="md:grid-cols-[660px_400px]"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[300px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[300px] text-[15px] leading-8 text-slate-900"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-14">
        <div className="flex flex-1 flex-col gap-9">
          <h1 className="text-[24px] font-semibold leading-8 text-slate-900">
            {isApproved ? "Application Submitted" : "Verification Status"}
          </h1>

          <div className="flex h-[486px] w-full flex-col gap-5">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Image
                    src={statusIconSrc(applicationStatus)}
                    alt={`${statusLabel} status`}
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px]"
                  />
                  <span className="text-[18px] font-semibold leading-7 text-slate-900">
                    {loading ? "Loading..." : statusLabel}
                  </span>
                </div>

                <span
                  className={`inline-flex min-h-9 items-center rounded-full px-4 text-[14px] font-medium leading-5 text-white ${statusBadgeClass(applicationStatus)}`}
                >
                  {loading ? "..." : statusLabel}
                </span>
              </div>

              <div className="flex flex-1 flex-col px-4 pb-6 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-[20px] font-semibold leading-7 text-slate-900">
                    {statusHeading(applicationStatus)}
                  </h2>
                  <time
                    className="text-[14px] font-normal leading-5 text-slate-500"
                    dateTime={submittedAt ?? undefined}
                  >
                    {loading ? "..." : submittedDateLabel}
                  </time>
                </div>

                {isApproved ? (
                  <div className="mt-4 max-w-[500px] space-y-5 text-[16px] font-normal leading-6 text-slate-700">
                    <ApplicantRecruiterNotes title="Message from recruiter" />
                    <p>
                      <span className="font-semibold text-slate-900">Congratulations!</span> Your
                      application was approved.
                      <br />
                      You can now claim a shift. Click the button below to browse a shift.
                    </p>
                    <p>{statusDescription(applicationStatus)}</p>
                  </div>
                ) : (
                  <div className="mt-4 max-w-[500px] space-y-5 text-[16px] font-normal leading-6 text-slate-700">
                    <ApplicantRecruiterNotes
                      title="What you need to do"
                      emptyMessage="Your application is pending. Your recruiter will add instructions here when needed."
                    />
                    <p>{statusDescription(applicationStatus)}</p>
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-end">
              {isApproved ? (
                <Link
                  href={applicationPath("/application/employee-agreement")}
                  className="inline-flex min-w-[185px] h-11 items-center justify-center gap-2 rounded-lg bg-[#0ea5a4] px-4 py-2.5 text-[16px] font-semibold leading-6 text-white transition hover:bg-[#0c8d8b]"
                >
                  Sign Employee Agreement
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex h-11 w-[150px] cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[16px] font-semibold leading-6 text-slate-400 opacity-70"
                >
                  Browse Shift
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
