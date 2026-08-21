import { AiAnalysisOverviewClient } from "../AiAnalysisOverviewClient";

type AiAnalysisPageProps = {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ jobId?: string }>;
};

export default async function AiAnalysisPage({ params, searchParams }: AiAnalysisPageProps) {
  const { applicationId } = await params;
  const { jobId } = await searchParams;
  const backHref = jobId?.trim()
    ? `/admin_recruiter/applications?jobId=${encodeURIComponent(jobId.trim())}`
    : "/admin_recruiter/applications";

  return (
    <AiAnalysisOverviewClient
      applicationId={applicationId}
      backHref={backHref}
      jobId={jobId?.trim() || undefined}
    />
  );
}
