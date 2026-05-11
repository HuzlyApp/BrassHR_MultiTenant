import Link from "next/link";

export default function AdminRecruiterJobsPage() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold text-[#0F172A]">Jobs / Assignments</h1>
      <p className="mt-2 text-sm text-[#64748B]">
        Use facility assignments as the current jobs workflow entry point.
      </p>
      <Link
        href="/admin_recruiter/new/facility-assignments"
        className="mt-4 inline-flex rounded-md border border-[#0c918a] px-3 py-2 text-sm text-[#0f514e] hover:bg-[#f2f8f7]"
      >
        Open facility assignments
      </Link>
    </main>
  );
}
