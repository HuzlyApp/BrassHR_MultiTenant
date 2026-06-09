import AdminRecruiterMessagesClient from "@/app/admin_recruiter/messages/AdminRecruiterMessagesClient";

type ConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function AdminRecruiterConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  return <AdminRecruiterMessagesClient initialWorkerId={conversationId} />;
}
