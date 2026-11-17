import { Suspense } from "react";
import ProfessionDocumentsPanel from "@/app/admin_recruiter/settings/ProfessionDocumentsPanel";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProfessionDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="w-full min-w-0 space-y-6">
      <Suspense
        fallback={
          <section className="space-y-4">
            <div className="h-10 max-w-xl rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
            <div className="h-48 rounded-2xl bg-[#E5E7EB] motion-safe:animate-pulse" />
          </section>
        }
      >
        <ProfessionDocumentsPanel detailProfessionId={id} />
      </Suspense>
    </div>
  );
}
