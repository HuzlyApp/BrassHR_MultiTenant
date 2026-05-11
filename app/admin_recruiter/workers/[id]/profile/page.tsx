import { redirect } from "next/navigation";

export default async function WorkerProfileRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin_recruiter/new/profile/${id}`);
}

