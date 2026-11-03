import { Suspense } from "react";
import EmployeeDetailClient from "@/app/admin_recruiter/reports/team-productivity/employees/[employeeId]/EmployeeDetailClient";

type PageProps = { params: Promise<{ employeeId: string }> };

export default async function EmployeeProductivityPage({ params }: PageProps) {
  const { employeeId } = await params;
  return (
    <Suspense
      fallback={
        <div className="px-4 py-[30px] text-sm text-[#6B7280] sm:px-6 lg:px-8">
          Loading employee performance…
        </div>
      }
    >
      <EmployeeDetailClient employeeId={employeeId} />
    </Suspense>
  );
}
