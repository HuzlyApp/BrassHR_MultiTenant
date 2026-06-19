import { TicketsSubNav } from "@/app/admin_recruiter/tickets/TicketsSubNav";

export default function TicketsDepartmentsPage() {
  return (
    <div className="pb-8">
      <div className="px-8 pt-6">
        <h1 className="text-[18px] font-semibold text-[#012352]">Departments</h1>
        <p className="mt-1 text-sm text-[#64748B]">Create a new support request for assistance.</p>
      </div>
      <TicketsSubNav />
      <div className="mx-8 rounded-xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#64748B]">
        Department management is coming soon.
      </div>
    </div>
  );
}
