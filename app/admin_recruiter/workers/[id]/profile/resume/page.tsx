import { redirect } from "next/navigation";

export default async function WorkerProfileResumeRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin_recruiter/new/profile/resume/${id}`);
}

