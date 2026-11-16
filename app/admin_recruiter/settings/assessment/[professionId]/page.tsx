import { Suspense } from "react";
import AssessmentProfessionDetailClient from "@/app/admin_recruiter/settings/AssessmentProfessionDetailClient";

type PageProps = {
  params: Promise<{ professionId: string }>;
};

export default async function AssessmentProfessionPage({ params }: PageProps) {
  const { professionId: rawProfessionId } = await params;
  const professionId = decodeURIComponent(rawProfessionId);

  return (
    <div className="w-full min-w-0 space-y-6">
      <Suspense
        fallback={
          <section className="space-y-4">
            <div className="h-5 w-40 rounded bg-[#E5E7EB] motion-safe:animate-pulse" />
            <div className="h-10 max-w-xl rounded-xl bg-[#E5E7EB] motion-safe:animate-pulse" />
            <div className="h-48 rounded-2xl bg-[#E5E7EB] motion-safe:animate-pulse" />
          </section>
        }
      >
        <AssessmentProfessionDetailClient professionId={professionId} />
      </Suspense>
    </div>
  );
}
