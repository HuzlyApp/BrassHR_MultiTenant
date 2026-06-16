import RecruiterTemplateBuilderForm from "@/app/admin_recruiter/components/RecruiterTemplateBuilderForm";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function EditRecruiterTemplatePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <RecruiterTemplateBuilderForm templateId={id} initialPreview={query.preview === "1"} />
    </main>
  );
}
