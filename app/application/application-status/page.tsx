"use client";

import { applicationPath, currentOnboardingTenantSlug } from "@/lib/tenant/with-tenant";
import { jobsListingHref } from "@/lib/onboarding/client-job-application";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  APPLICANT_SHELL_TALL_CLASS,
  APPLICANT_TITLE_CLASS,
} from "@/app/application/applicant-onboarding-responsive";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import ApplicantRecruiterNotes from "@/app/application/components/ApplicantRecruiterNotes";
import type { ApplicationStatusKey } from "@/lib/applicant-portal";
import { sendApplicationSubmissionEmail } from "@/lib/onboarding/send-application-submission-email";

type JobApplicationItem = {
  applicationId: string;
  jobTitle: string;
  jobLocation: string | null;
  status: string;
  statusLabel: string;
  appliedAt: string;
  submittedAt: string | null;
};

type ApplicationStatusResponse = {
  applicationStatus?: ApplicationStatusKey;
  statusLabel?: string;
  submittedAt?: string;
  jobApplications?: JobApplicationItem[];
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

function workerStatusBadgeClass(status: ApplicationStatusKey): string {
  if (status === "approved") return "bg-[#2ec9b5]";
  if (status === "rejected") return "bg-[#ef4444]";
  if (status === "under_review") return "bg-[#3b82f6]";
  return "bg-[#f59e0b]";
}

function jobApplicationStatusBadgeClass(statusLabel: string): string {
  const normalized = statusLabel.trim().toLowerCase();
  if (normalized === "approved" || normalized === "hired") return "bg-[#2ec9b5]";
  if (normalized === "not selected" || normalized === "rejected") return "bg-[#ef4444]";
  if (normalized === "under review" || normalized === "reviewing" || normalized === "interviewing") {
    return "bg-[#3b82f6]";
  }
  if (normalized === "in progress") return "bg-[#94a3b8]";
  return "bg-[#f59e0b]";
}

function statusIconSrc(status: ApplicationStatusKey): string {
  return status === "approved" ? "/icons/approved.svg" : "/icons/pending.svg";
}

function statusHeading(status: ApplicationStatusKey, hasJobApplications: boolean): string {
  if (hasJobApplications) return "Your Job Applications";
  if (status === "approved") return "Application Approved";
  if (status === "rejected") return "Application Not Approved";
  if (status === "under_review") return "Application Under Review";
  return "Application Submitted";
}

function statusDescription(status: ApplicationStatusKey, hasJobApplications: boolean): string {
  if (hasJobApplications) {
    return "Track the status of each job you have applied for. You can apply to additional open positions at any time while your applications are under review.";
  }
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
  const [jobApplications, setJobApplications] = useState<JobApplicationItem[]>([]);
  const [jobsHref, setJobsHref] = useState("/jobs");

  useEffect(() => {
    const tenantSlug =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("tenant")?.trim().toLowerCase() ||
          currentOnboardingTenantSlug()
        : null;
    setJobsHref(jobsListingHref(tenantSlug));
  }, []);

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
          setJobApplications(Array.isArray(data.jobApplications) ? data.jobApplications : []);
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
  const hasJobApplications = jobApplications.length > 0;
  const submittedDateLabel = formatSubmittedDate(submittedAt);

  return (
    <OnboardingLayout
      cardClassName="min-[700px]:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)] min-[1200px]:grid-cols-[minmax(0,1.65fr)_minmax(220px,1fr)]"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[300px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[300px] text-[15px] leading-8 text-slate-900"
    >
      <div className={APPLICANT_SHELL_TALL_CLASS}>
        <div className="flex flex-1 flex-col gap-6 sm:gap-9">
          <h1 className={`${APPLICANT_TITLE_CLASS} text-slate-900`}>
            {isApproved && !hasJobApplications ? "Application Submitted" : "Verification Status"}
          </h1>

          <div className="flex w-full flex-col gap-5">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Image
                    src={statusIconSrc(applicationStatus)}
                    alt={`${statusLabel} status`}
                    width={30}
                    height={30}
                    className="h-[30px] w-[30px] shrink-0"
                  />
                  <span className="truncate text-base font-semibold leading-6 text-slate-900 sm:text-[18px] sm:leading-7">
                    {loading ? "Loading..." : hasJobApplications ? "Application Status" : statusLabel}
                  </span>
                </div>

                {!hasJobApplications ? (
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[13px] font-medium leading-5 text-white sm:min-h-9 sm:px-4 sm:text-[14px] ${workerStatusBadgeClass(applicationStatus)}`}
                  >
                    {loading ? "..." : statusLabel}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col px-3 pb-5 pt-4 sm:px-4 sm:pb-6 sm:pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h2 className="text-base font-semibold leading-6 text-slate-900 sm:text-[20px] sm:leading-7">
                    {loading ? "Checking your application..." : statusHeading(applicationStatus, hasJobApplications)}
                  </h2>
                  {!hasJobApplications ? (
                    <time
                      className="text-[14px] font-normal leading-5 text-slate-500"
                      dateTime={submittedAt ?? undefined}
                    >
                      {loading ? "..." : submittedDateLabel}
                    </time>
                  ) : null}
                </div>

                {hasJobApplications ? (
                  <div className="mt-4 space-y-3">
                    {loading ? (
                      <p className="text-sm text-slate-500">Loading your applications...</p>
                    ) : (
                      <ul className="space-y-3">
                        {jobApplications.map((application) => (
                          <li
                            key={application.applicationId}
                            className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[15px] font-semibold leading-6 text-slate-900">
                                  {application.jobTitle}
                                </p>
                                {application.jobLocation ? (
                                  <p className="mt-0.5 text-sm text-slate-500">
                                    {application.jobLocation}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-xs text-slate-400">
                                  Applied {formatSubmittedDate(application.appliedAt)}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium text-white ${jobApplicationStatusBadgeClass(application.statusLabel)}`}
                              >
                                {application.statusLabel}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {isApproved && !hasJobApplications ? (
                  <div className="mt-4 max-w-[500px] space-y-5 text-[16px] font-normal leading-6 text-slate-700">
                    <ApplicantRecruiterNotes title="Message from recruiter" />
                    <p>
                      <span className="font-semibold text-slate-900">Congratulations!</span> Your
                      application was approved.
                      <br />
                      You can now claim a shift. Click the button below to browse a shift.
                    </p>
                    <p>{statusDescription(applicationStatus, hasJobApplications)}</p>
                  </div>
                ) : (
                  <div className="mt-4 max-w-[500px] space-y-5 text-[16px] font-normal leading-6 text-slate-700">
                    <ApplicantRecruiterNotes
                      title="What you need to do"
                      emptyMessage="Your application is pending. Your recruiter will add instructions here when needed."
                    />
                    <p>
                      {loading
                        ? "Please wait while we load your application status."
                        : statusDescription(applicationStatus, hasJobApplications)}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                href={jobsHref}
                className="inline-flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-lg border border-[#0ea5a4] bg-white px-4 py-2.5 text-[16px] font-semibold leading-6 text-[#0ea5a4] transition hover:bg-[#f0fdfa]"
              >
                Apply to More Jobs
              </Link>
              {isApproved ? (
                <Link
                  href={applicationPath("/application/employee-agreement")}
                  className="inline-flex min-w-[185px] h-11 items-center justify-center gap-2 rounded-lg bg-[#0ea5a4] px-4 py-2.5 text-[16px] font-semibold leading-6 text-white transition hover:bg-[#0c8d8b]"
                >
                  Sign Employee Agreement
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
