import { redirect } from "next/navigation";

export default async function WorkerProfileNotesRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin_recruiter/new/profile/notes/${id}`);
}

