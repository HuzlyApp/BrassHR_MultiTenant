import { Suspense } from "react";
import AdminRecruiterMessagesClient from "@/app/admin_recruiter/messages/AdminRecruiterMessagesClient";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";

export default function AdminRecruiterMessagesPage() {
  return (
    <Suspense fallback={<CandidateDetailLoader label="Loading messages..." className="min-h-[360px]" />}>
      <AdminRecruiterMessagesClient />
    </Suspense>
  );
}
