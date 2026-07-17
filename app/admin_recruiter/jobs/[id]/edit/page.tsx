import JobRequisitionForm from "@/app/admin_recruiter/jobs/JobRequisitionForm";

export default async function EditJobRequisitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobRequisitionForm jobId={id} />;
}
