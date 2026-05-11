type ConversationPageProps = {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ shift?: string }>;
};

export default async function AdminRecruiterConversationPage({ params, searchParams }: ConversationPageProps) {
  const { conversationId } = await params;
  const { shift } = await searchParams;

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold text-[#0F172A]">Conversation</h1>
      <p className="mt-2 text-sm text-[#64748B]">Conversation user ID: {conversationId}</p>
      {shift ? <p className="text-sm text-[#64748B]">Shift: {shift}</p> : null}
    </main>
  );
}
