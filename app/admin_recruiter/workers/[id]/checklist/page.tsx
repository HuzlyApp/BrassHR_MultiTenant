import { redirect } from "next/navigation";

export default async function WorkerChecklistRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin_recruiter/new/checklist/${id}`);
}

