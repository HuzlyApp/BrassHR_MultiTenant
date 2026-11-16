import RecruiterTemplateFolderDetail from "@/app/admin_recruiter/components/RecruiterTemplateFolderDetail";

export default async function RecruiterTemplateFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  return (
    <div className="w-full min-w-0">
      <RecruiterTemplateFolderDetail folderId={folderId} />
    </div>
  );
}
