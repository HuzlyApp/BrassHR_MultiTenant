import { Suspense } from "react";
import PublicJobsSearchPage from "./public-jobs-client";

export default function JobsPage() {
  return (
    <Suspense fallback={<main className="p-10 text-sm text-[#64748B]">Loading jobs…</main>}>
      <PublicJobsSearchPage />
    </Suspense>
  );
}
