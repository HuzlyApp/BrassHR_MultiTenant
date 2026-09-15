import { Suspense } from "react";
import { CandidatesAiAnalysisClient } from "./CandidatesAiAnalysisClient";

type CandidateAiAnalysisPageProps = {
  params: Promise<{ workerId: string }>;
};

export default async function CandidateAiAnalysisPage({ params }: CandidateAiAnalysisPageProps) {
  const { workerId } = await params;
  return (
    <Suspense
      fallback={
        <div className="box-border w-full min-w-0 max-w-full px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8">
          <div className="mt-8 rounded-xl border border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#667085]">
            Loading AI analysis…
          </div>
        </div>
      }
    >
      <CandidatesAiAnalysisClient workerId={workerId} />
    </Suspense>
  );
}
