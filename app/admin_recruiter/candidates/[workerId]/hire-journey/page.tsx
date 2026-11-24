import { redirect } from "next/navigation";

/**
 * Legacy hire-journey URL from older handoff docs.
 * Canonical surface is the chrome-wrapped pre-hire journey.
 */
export default async function HireJourneyPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  const id = workerId?.trim();
  if (!id) {
    redirect("/admin_recruiter/applications");
  }
  redirect(`/admin_recruiter/new/pre-hire/${encodeURIComponent(id)}`);
}
