import { redirect } from "next/navigation";

type AddCandidatePageProps = {
  searchParams: Promise<{ jobId?: string }>;
};

/**
 * Legacy full-page add candidate route — replaced by AddCandidateModal on the
 * candidates listing. Redirects back to the listing.
 */
export default async function AddCandidatePage({ searchParams }: AddCandidatePageProps) {
  const params = await searchParams;
  const jobId = params.jobId?.trim();
  if (jobId) {
    redirect(`/admin_recruiter/applications?jobId=${encodeURIComponent(jobId)}`);
  }
  redirect("/admin_recruiter/applications");
}
