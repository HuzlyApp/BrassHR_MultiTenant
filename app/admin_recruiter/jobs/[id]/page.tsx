import JobDetailsClient from "@/app/admin_recruiter/jobs/JobDetailsClient";

export default async function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobDetailsClient jobId={id} />;
}
