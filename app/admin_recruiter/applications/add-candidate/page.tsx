import { Suspense } from "react";
import AddCandidateClient from "@/app/admin_recruiter/applications/AddCandidateClient";

export default function AddCandidatePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-1 py-2 text-sm text-[#64748B]">Loading…</div>
      }
    >
      <AddCandidateClient />
    </Suspense>
  );
}
