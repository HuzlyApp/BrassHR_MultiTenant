import { Suspense } from "react";
import AdminRecruiterMailClient from "./AdminRecruiterMailClient";

export default function AdminRecruiterMailPage() {
  return (
    <Suspense fallback={null}>
      <AdminRecruiterMailClient />
    </Suspense>
  );
}
