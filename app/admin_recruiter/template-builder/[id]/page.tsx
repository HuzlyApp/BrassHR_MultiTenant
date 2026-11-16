import { Suspense } from "react";
import RecruiterTemplateBuilderForm from "@/app/admin_recruiter/components/RecruiterTemplateBuilderForm";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function EditRecruiterTemplatePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <main className="w-full px-4 py-6 md:px-6">
      <Suspense
        fallback={
          <div className="rounded-xl border border-[#EAECF0] bg-white p-10 text-center text-sm text-[#667085]">
            Loading template...
          </div>
        }
      >
        <RecruiterTemplateBuilderForm templateId={id} initialPreview={query.preview === "1"} />
      </Suspense>
    </main>
  );
}
