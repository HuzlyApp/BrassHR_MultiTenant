import { Suspense } from "react";
import AdminRecruiterMailClient from "./AdminRecruiterMailClient";

export default function AdminRecruiterMailPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-recruiter-page-pad py-12 text-center text-sm text-[#64748B]">
          Loading mail...
        </div>
      }
    >
      <AdminRecruiterMailClient />
    </Suspense>
  );
}
