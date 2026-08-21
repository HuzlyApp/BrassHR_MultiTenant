import { Suspense } from "react";
import { CandidateProfileClient } from "./CandidateProfileClient";

type CandidateProfilePageProps = {
  params: Promise<{ workerId: string }>;
};

export default async function CandidateProfilePage({ params }: CandidateProfilePageProps) {
  const { workerId } = await params;
  return (
    <Suspense
      fallback={
        <div className="box-border w-full min-w-0 max-w-full px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-8 text-sm text-[#64748B]">
            Loading candidate profile…
          </div>
        </div>
      }
    >
      <CandidateProfileClient workerId={workerId} />
    </Suspense>
  );
}
