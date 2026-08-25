import { Suspense } from "react";
import AdminRecruiterMessagesClient from "@/app/admin_recruiter/messages/AdminRecruiterMessagesClient";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";

type ConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function AdminRecruiterConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  return (
    <Suspense fallback={<CandidateDetailLoader label="Loading messages..." className="min-h-[360px]" />}>
      <AdminRecruiterMessagesClient initialWorkerId={conversationId} />
    </Suspense>
  );
}
