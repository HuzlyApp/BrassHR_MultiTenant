import { Suspense } from "react";
import JobCandidateReviewClient from "../JobCandidateReviewClient";

export default function JobCandidateReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-10 text-sm text-[#64748B]">Loading candidate details…</div>
      }
    >
      <JobCandidateReviewClient />
    </Suspense>
  );
}
