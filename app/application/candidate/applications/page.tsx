"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CandidateApplicationsTab } from "@/app/application/components/applicant-portal/CandidateApplicationsTab";
import { CandidateApplicationDetail } from "@/app/application/components/applicant-portal/CandidateApplicationDetail";
import {
  CANDIDATE_BTN_NAVY,
  CandidatePageIntro,
} from "@/app/application/components/applicant-portal/candidate-portal-ui";
import { applicationPath } from "@/lib/tenant/with-tenant";

export default function CandidateApplicationsPage() {
  const searchParams = useSearchParams();
  const jobsHref = applicationPath("/application/candidate/jobs", searchParams?.get("tenant"));

  return (
    <div className="w-full min-w-0 px-4 py-6 min-[1000px]:px-8">
      <CandidatePageIntro
        title="Your Applications"
        subtitle="Stay updated on your application progress and hiring status."
        action={
          <Link href={jobsHref} className={CANDIDATE_BTN_NAVY}>
            Find more jobs
          </Link>
        }
      />
      {searchParams?.get("application") ? (
        <CandidateApplicationDetail key={searchParams.get("application")} applicationId={searchParams.get("application")!} tenant={searchParams.get("tenant")} />
      ) : <CandidateApplicationsTab portalPage />}
    </div>
  );
}
