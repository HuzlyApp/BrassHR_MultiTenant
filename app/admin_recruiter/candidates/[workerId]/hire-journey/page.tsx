import { Suspense } from "react";
import HireJourneyClient from "./HireJourneyClient";

export default async function HireJourneyPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  return (
    <Suspense
      fallback={
        <div className="admin-recruiter-page-pad">
          <div className="admin-recruiter-content-width rounded-xl border border-[#E5E7EB] bg-white px-5 py-10 text-sm text-[#64748B]">
            Loading hire journey…
          </div>
        </div>
      }
    >
      <HireJourneyClient workerId={workerId} />
    </Suspense>
  );
}
